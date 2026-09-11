/**
 * 日志/流水表的保留期治理。
 *
 * 这些表只增不删：translation_api_log 每次翻译都写一行，
 * translation_job_store 存任务快照，admin_audit_log 记后台操作。
 * 站点规模不大，但跑一两年后表会无意义地膨胀，备份体积和查询都跟着变差。
 *
 * 清理策略：按时间保留 + 行数上限兜底（防止短期内爆发式写入）。
 * 默认阈值保守，宁可多留；可用环境变量调整，设为 0 表示不清理。
 */
import { getDb } from '../db.js';

function days(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

function maxRows(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

const POLICIES = [
  {
    table: 'translation_api_log',
    dateCol: 'called_at',
    days: days('RETENTION_API_LOG_DAYS', 90),
    keep: maxRows('RETENTION_API_LOG_MAX_ROWS', 20000),
  },
  {
    table: 'translation_job_store',
    dateCol: 'created_at',
    // 已完成任务只留 60 天，够回看失败原因即可
    days: days('RETENTION_JOB_STORE_DAYS', 60),
    keep: maxRows('RETENTION_JOB_STORE_MAX_ROWS', 5000),
  },
  // 注意：admin_audit_log 由 services/audit.js 自带保留期清理（AUDIT_RETENTION_DAYS），
  // 这里刻意不纳入，避免两套机制互相覆盖。
];

function tableExists(db, name) {
  return !!db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?")
    .get(name);
}

function hasColumn(db, table, col) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === col);
}

/**
 * 执行一次清理，返回各表删除行数。
 * 任何单表失败都不影响其它表，也不向上抛 —— 清理是后台维护，不能拖垮启动。
 */
export function pruneOnce() {
  const db = getDb();
  const result = {};

  for (const p of POLICIES) {
    try {
      if (!tableExists(db, p.table) || !hasColumn(db, p.table, p.dateCol)) continue;

      let removed = 0;
      if (p.days > 0) {
        removed += db
          .prepare(
            `DELETE FROM ${p.table}
              WHERE ${p.dateCol} < datetime('now', ?)`
          )
          .run(`-${p.days} days`).changes;
      }
      // 行数兜底：保留最新 keep 行，其余删掉（即便还没到期）
      if (p.keep > 0) {
        removed += db
          .prepare(
            `DELETE FROM ${p.table}
              WHERE id NOT IN (
                SELECT id FROM ${p.table} ORDER BY id DESC LIMIT ?
              )`
          )
          .run(p.keep).changes;
      }
      if (removed) result[p.table] = removed;
    } catch (err) {
      console.error(`[retention] prune ${p.table} failed:`, err.message);
    }
  }

  // 回收空间：DELETE 不会缩小文件，定期 VACUUM 一次
  const totalRemoved = Object.values(result).reduce((a, b) => a + b, 0);
  if (totalRemoved > 0) {
    try {
      if (String(process.env.RETENTION_VACUUM || '1') !== '0') db.exec('VACUUM');
    } catch (err) {
      console.error('[retention] vacuum failed:', err.message);
    }
  }
  return result;
}

/**
 * 启动后延迟执行一次，之后每 12 小时一次。
 * 延迟启动是为了避开开机时的请求高峰与备份窗口。
 */
export function startRetentionJob() {
  const intervalHours = Number(process.env.RETENTION_INTERVAL_HOURS || 12);
  const run = () => {
    try {
      const r = pruneOnce();
      const keys = Object.keys(r);
      if (keys.length) {
        console.log('[retention] ' + keys.map((k) => `${k} -${r[k]}`).join(', '));
      }
    } catch (err) {
      console.error('[retention] job failed:', err.message);
    }
  };
  const bootDelayMs = 60 * 1000;
  const timer = setTimeout(run, bootDelayMs);
  const interval = setInterval(run, Math.max(1, intervalHours) * 3600 * 1000);
  // 不阻止进程退出
  if (timer.unref) timer.unref();
  if (interval.unref) interval.unref();
  return { stop: () => { clearTimeout(timer); clearInterval(interval); } };
}

/**
 * 删除历史遗留的空表（旧 schema 残留，代码零引用）。
 * 只删确认无引用且行数为 0 的表，避免误伤。
 */
export function dropLegacyTables() {
  const db = getDb();
  const legacy = ['translation_jobs'];
  const dropped = [];
  for (const name of legacy) {
    try {
      if (!tableExists(db, name)) continue;
      const { n } = db.prepare(`SELECT COUNT(*) AS n FROM ${name}`).get();
      if (Number(n) !== 0) {
        console.warn(`[retention] 表 ${name} 非空（${n} 行），跳过删除`);
        continue;
      }
      db.exec(`DROP TABLE ${name}`);
      dropped.push(name);
    } catch (err) {
      console.error(`[retention] drop ${name} failed:`, err.message);
    }
  }
  return dropped;
}
