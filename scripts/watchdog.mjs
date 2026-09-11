#!/usr/bin/env node
/**
 * TXAM 服务守护进程（零依赖，Node 内置模块实现）
 *
 * 作用：
 *   1. 拉起 server/src/index.js，进程崩溃/异常退出时自动重启（指数退避）
 *   2. 每 30s 对 /api/v1/health 做心跳探测，连续失败则重启子进程
 *   3. 把子进程 stdout/stderr 落盘到 logs/server.log（按大小滚动）
 *   4. 维护 logs/watchdog.pid 单实例锁，避免重复拉起多个服务
 *
 * 用法：
 *   node scripts/watchdog.mjs            # 前台运行（默认 start）
 *   node scripts/watchdog.mjs start      # 同上
 *   node scripts/watchdog.mjs stop       # 停止守护与其子进程
 *   node scripts/watchdog.mjs status     # 查看运行状态
 *
 * Windows 开机自启（任选其一）：
 *   A. NSSM（推荐）：nssm install TXAM-CMS "C:\path\to\node.exe" "H:\tongxing\scripts\watchdog.mjs"
 *      nssm set TXAM-CMS AppDirectory H:\tongxing
 *      nssm set TXAM-CMS AppStdout H:\tongxing\logs\nssm.log
 *      nssm start TXAM-CMS
 *   B. 计划任务：触发器「启动时」→ 操作 node.exe → 参数 scripts\watchdog.mjs → 起始位置 H:\tongxing
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const SERVER_DIR = path.join(REPO_ROOT, 'server');
const LOG_DIR = path.join(REPO_ROOT, 'logs');
const PID_FILE = path.join(LOG_DIR, 'watchdog.pid');
const SERVER_LOG = path.join(LOG_DIR, 'server.log');
const WATCHDOG_LOG = path.join(LOG_DIR, 'watchdog.log');

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const KEEP_LOG_GENERATIONS = 3;
const HEALTH_INTERVAL_MS = 30_000;
const HEALTH_FAIL_THRESHOLD = 3;
const UPTIME_RESET_MS = 60_000; // 稳定运行超过 60s 后重置退避计数

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function rotateIfNeeded(file) {
  try {
    if (!fs.existsSync(file)) return;
    if (fs.statSync(file).size < MAX_LOG_SIZE) return;
    for (let i = KEEP_LOG_GENERATIONS - 1; i >= 1; i -= 1) {
      const from = `${file}.${i}`;
      const to = `${file}.${i + 1}`;
      if (fs.existsSync(from)) fs.renameSync(from, to);
    }
    fs.renameSync(file, `${file}.1`);
  } catch {
    /* 日志滚动失败不影响主流程 */
  }
}

function log(line) {
  ensureDir(LOG_DIR);
  rotateIfNeeded(WATCHDOG_LOG);
  const stamp = new Date().toISOString();
  const text = `[${stamp}] ${line}\n`;
  try {
    fs.appendFileSync(WATCHDOG_LOG, text);
  } catch {
    /* ignore */
  }
  process.stdout.write(text);
}

/* ── 读取服务端端口（复用 server/.env，避免重复解析逻辑） ─────────────── */

function readPort() {
  const envFile = path.join(SERVER_DIR, '.env');
  let port = 8204;
  if (fs.existsSync(envFile)) {
    const text = fs.readFileSync(envFile, 'utf8').replace(/^﻿/, '');
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*PORT\s*=\s*(.+?)\s*$/.exec(line);
      if (m) {
        const n = Number(m[1].replace(/^["']|["']$/g, ''));
        if (Number.isFinite(n) && n > 0) port = n;
      }
    }
  }
  if (process.env.PORT) {
    const n = Number(process.env.PORT);
    if (Number.isFinite(n) && n > 0) port = n;
  }
  return port;
}

const PORT = readPort();
const HEALTH_URL = `http://127.0.0.1:${PORT}/api/v1/health`;

/* ── 单实例锁 ────────────────────────────────────────────────────────── */

function isPidAlive(pid) {
  if (!Number.isFinite(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0); // signal 0 = 探活，不真正发送信号
    return true;
  } catch (err) {
    return err.code === 'EPERM'; // 权限不足说明进程存在（但非本用户）
  }
}

function readLock() {
  if (!fs.existsSync(PID_FILE)) return null;
  const raw = fs.readFileSync(PID_FILE, 'utf8').trim();
  const pid = Number(raw);
  return Number.isFinite(pid) ? pid : null;
}

function acquireLock() {
  const existing = readLock();
  if (existing && existing !== process.pid && isPidAlive(existing)) {
    return existing;
  }
  ensureDir(LOG_DIR);
  fs.writeFileSync(PID_FILE, String(process.pid));
  return null;
}

function releaseLock() {
  try {
    if (readLock() === process.pid) fs.unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
}

/* ── 健康检查 ────────────────────────────────────────────────────────── */

function healthCheck() {
  return new Promise((resolve) => {
    const req = http.get(HEALTH_URL, { timeout: 5000 }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        let ok = res.statusCode === 200;
        if (ok) {
          try {
            ok = JSON.parse(body).ok === true;
          } catch {
            ok = false;
          }
        }
        resolve(ok);
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(false); });
    req.on('error', () => resolve(false));
  });
}

/* ── 守护主体 ────────────────────────────────────────────────────────── */

let child = null;
let stopping = false;
let restarts = 0;
let consecutiveFailures = 0;
let healthTimer = null;
let serverLogStream = null;

function openServerLog() {
  ensureDir(LOG_DIR);
  rotateIfNeeded(SERVER_LOG);
  serverLogStream = fs.createWriteStream(SERVER_LOG, { flags: 'a' });
}

function closeServerLog() {
  if (serverLogStream) {
    try { serverLogStream.end(); } catch { /* ignore */ }
    serverLogStream = null;
  }
}

function spawnChild() {
  openServerLog();
  child = spawn(process.execPath, ['src/index.js'], {
    cwd: SERVER_DIR,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  const startedAt = Date.now();
  const prefix = `[${new Date(startedAt).toISOString()}] ---- server start (pid ${child.pid}) ----\n`;
  serverLogStream.write(prefix);

  child.stdout.on('data', (buf) => {
    rotateIfNeeded(SERVER_LOG);
    serverLogStream.write(buf);
  });
  child.stderr.on('data', (buf) => {
    rotateIfNeeded(SERVER_LOG);
    serverLogStream.write(buf);
  });

  child.on('exit', (code, signal) => {
    closeServerLog();
    const livedMs = Date.now() - startedAt;
    child = null;
    if (stopping) {
      log(`server stopped (code=${code} signal=${signal})`);
      return;
    }
    log(`server exited unexpectedly (code=${code} signal=${signal}) after ${livedMs}ms`);
    if (livedMs > UPTIME_RESET_MS) restarts = 0; // 稳定运行后重置退避
    scheduleRestart();
  });

  child.on('error', (err) => {
    log(`server spawn error: ${err && err.message}`);
  });

  log(`server started (pid ${child.pid}), health=${HEALTH_URL}`);
}

function scheduleRestart() {
  const backoff = Math.min(30_000, 1000 * 2 ** Math.min(restarts, 5));
  const jitter = Math.floor(Math.random() * 500);
  const delay = backoff + jitter;
  restarts += 1;
  log(`restarting in ${Math.round(delay / 1000)}s (attempt #${restarts})`);
  setTimeout(() => {
    if (stopping) return;
    if (child) return; // 已有存活子进程，避免重复拉起
    spawnChild();
  }, delay);
}

async function tick() {
  if (stopping || !child) return;
  const ok = await healthCheck();
  if (ok) {
    if (consecutiveFailures) log(`health recovered after ${consecutiveFailures} failure(s)`);
    consecutiveFailures = 0;
    return;
  }
  consecutiveFailures += 1;
  log(`health check failed (${consecutiveFailures}/${HEALTH_FAIL_THRESHOLD})`);
  if (consecutiveFailures >= HEALTH_FAIL_THRESHOLD) {
    consecutiveFailures = 0;
    log('health threshold reached — killing server for restart');
    try { child.kill('SIGKILL'); } catch { /* ignore */ }
  }
}

function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`watchdog received ${signal} — shutting down`);
  if (healthTimer) clearInterval(healthTimer);
  if (child) {
    try { child.kill('SIGTERM'); } catch { /* ignore */ }
    const hardKill = setTimeout(() => {
      try { child && child.kill('SIGKILL'); } catch { /* ignore */ }
    }, 8000);
    child.once('exit', () => { clearTimeout(hardKill); releaseLock(); process.exit(0); });
    setTimeout(() => { releaseLock(); process.exit(0); }, 10000);
  } else {
    releaseLock();
    process.exit(0);
  }
}

function start() {
  const owner = acquireLock();
  if (owner) {
    log(`another watchdog is already running (pid ${owner}) — exit`);
    process.exit(1);
  }
  log(`watchdog start (pid ${process.pid}), port ${PORT}`);
  spawnChild();
  healthTimer = setInterval(tick, HEALTH_INTERVAL_MS);
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('uncaughtException', (err) => log(`watchdog uncaughtException: ${err && err.message}`));
}

function stop() {
  const pid = readLock();
  if (!pid || !isPidAlive(pid)) {
    log('no running watchdog found');
    releaseLock();
    return;
  }
  log(`stopping watchdog ${pid}`);
  try { process.kill(pid, 'SIGTERM'); } catch (err) { log(`kill failed: ${err.message}`); }
}

function status() {
  const pid = readLock();
  const alive = pid && isPidAlive(pid);
  console.log(`watchdog: ${alive ? `running (pid ${pid})` : 'not running'}`);
  console.log(`health:   ${HEALTH_URL}`);
  console.log(`logs:     ${LOG_DIR}`);
}

const cmd = (process.argv[2] || 'start').toLowerCase();
ensureDir(LOG_DIR);
if (cmd === 'stop') stop();
else if (cmd === 'status') status();
else start();
