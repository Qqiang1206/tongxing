/**
 * Admin accounts + role-based access control (RBAC).
 *
 * Roles bundle a fixed set of permissions. The backend enforces permissions
 * via requirePermission(); the frontend mirrors the matrix to hide UI affordances
 * (UX only — the backend is the source of truth).
 */
import crypto from 'crypto';
import { getDb } from '../db.js';

/* ── Permission catalogue ─────────────────────────────────────────────── */

export const PERMISSIONS = [
  'content.read',
  'content.write',
  'media.read',
  'media.write',
  'translation.read',
  'translation.write',
  'analytics.read',
  'audit.read',
  'backup.read',
  'backup.write',
  'account.manage',
];

export const ROLES = {
  super_admin: {
    label: '超级管理员',
    desc: '全部权限，含账号管理与备份恢复',
    permissions: new Set(PERMISSIONS),
  },
  editor: {
    label: '内容编辑',
    desc: '产品/方案/新闻/页面/分类/素材的增删改发布',
    permissions: new Set([
      'content.read', 'content.write',
      'media.read', 'media.write',
      'translation.read',
      'analytics.read', 'audit.read',
    ]),
  },
  translator: {
    label: '翻译运营',
    desc: '翻译同步、术语表、翻译引擎；可查看内容',
    permissions: new Set([
      'content.read',
      'media.read',
      'translation.read', 'translation.write',
      'analytics.read',
    ]),
  },
  viewer: {
    label: '只读访客',
    desc: '只查看，不修改',
    permissions: new Set([
      'content.read',
      'media.read',
      'translation.read',
      'analytics.read', 'audit.read',
    ]),
  },
};

export const ROLE_KEYS = Object.keys(ROLES);

export function roleLabel(role) {
  return (ROLES[role] && ROLES[role].label) || role;
}

export function rolePermissions(role) {
  return (ROLES[role] && ROLES[role].permissions) || new Set();
}

export function hasPermission(role, permission) {
  return rolePermissions(role).has(permission);
}

/* ── Password hashing (scrypt) ────────────────────────────────────────── */

const SCRYPT_KEYLEN = 64;

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  return salt + ':' + derived;
}

export function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const idx = stored.indexOf(':');
  if (idx < 0) return false;
  const salt = stored.slice(0, idx);
  const expected = stored.slice(idx + 1);
  const actual = crypto.scryptSync(String(password), salt, SCRYPT_KEYLEN).toString('hex');
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/* ── CRUD ─────────────────────────────────────────────────────────────── */

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    role: row.role,
    status: row.status,
    createdBy: row.created_by || '',
    lastLoginAt: row.last_login_at || '',
    createdAt: row.created_at || '',
    permissions: [...rolePermissions(row.role)],
  };
}

export function listAdminUsers() {
  const db = getDb();
  return db.prepare('SELECT * FROM admin_users ORDER BY id').all().map(publicUser);
}

export function getAdminUserById(id) {
  const db = getDb();
  return publicUser(db.prepare('SELECT * FROM admin_users WHERE id = ?').get(Number(id)));
}

export function findAdminByUsername(username) {
  const db = getDb();
  return db.prepare('SELECT * FROM admin_users WHERE username = ?').get(String(username || '').trim());
}

export function authenticate(username, password) {
  const row = findAdminByUsername(username);
  if (!row) return null;
  if (row.status !== 'active') return null;
  if (!verifyPassword(password, row.password_hash)) return null;
  getDb()
    .prepare(`UPDATE admin_users SET last_login_at = datetime('now') WHERE id = ?`)
    .run(row.id);
  return publicUser(row);
}

/* ── Credential policy ────────────────────────────────────────────────── */

// Set ALLOW_WEAK_CREDENTIALS=1 to relax the policy for local development only.
const STRICT_CREDENTIALS = String(process.env.ALLOW_WEAK_CREDENTIALS || '') !== '1';
const MIN_LENGTH = 10;
const WEAK_DENYLIST = new Set([
  'admin', 'admin123', 'admin888', 'administrator', 'root', 'root123',
  'password', 'password1', 'passw0rd', '123456', '12345678', '123456789',
  '1234567890', '111111', '000000', '888888', '666666', 'a123456',
  'qwerty', 'qwerty123', 'abc123', 'letmein', 'welcome', 'iloveyou',
  'txam', 'txam123', 'tongxing', 'tongxing123', 'changeme', 'test1234',
]);

/**
 * 校验凭据强度。规则（严格模式）：
 *   - 至少 10 位
 *   - 不能与用户名相同
 *   - 不能在常见弱口令黑名单内
 *   - 不能是纯数字
 * 返回错误码字符串，通过则返回 null。
 */
export function checkCredentialStrength(secret, username) {
  const pwd = String(secret || '');
  if (!STRICT_CREDENTIALS) return pwd.length >= 6 ? null : 'weak_credential';
  if (pwd.length < MIN_LENGTH) return 'weak_credential';
  if (username && pwd.toLowerCase() === String(username).trim().toLowerCase()) {
    return 'credential_same_as_username';
  }
  if (WEAK_DENYLIST.has(pwd.toLowerCase())) return 'credential_denylisted';
  if (/^\d+$/.test(pwd)) return 'credential_all_digits';
  return null;
}

function assertCredential(secret, username) {
  const code = checkCredentialStrength(secret, username);
  if (code) {
    const err = new Error('weak_password');
    err.code = code;
    throw err;
  }
  return String(secret);
}

function assertUsername(username) {
  const u = String(username || '').trim();
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(u)) {
    throw new Error('invalid_username');
  }
  return u;
}

function assertRole(role) {
  if (!ROLES[role]) throw new Error('invalid_role');
  return role;
}

export function createAdminUser({ username, displayName, password, role, createdBy }) {
  const db = getDb();
  const u = assertUsername(username);
  assertRole(role);
  if (!String(password || '') || String(password).length < 6) throw new Error('weak_password');
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(u);
  if (existing) throw new Error('username_taken');
  const info = db.prepare(
    `INSERT INTO admin_users (username, display_name, password_hash, role, status, created_by)
     VALUES (?, ?, ?, ?, 'active', ?)`
  ).run(u, String(displayName || u).trim().slice(0, 40), hashPassword(password), role, String(createdBy || '').slice(0, 40));
  return getAdminUserById(info.lastInsertRowid);
}

export function updateAdminUser(id, patch, actorUsername) {
  const db = getDb();
  const row = db.prepare('SELECT * FROM admin_users WHERE id = ?').get(Number(id));
  if (!row) throw new Error('not_found');

  if (patch.role != null) assertRole(patch.role);

  // Guard: cannot disable/demote the last active super_admin.
  const becomingInactive = patch.status === 'disabled' && row.status === 'active';
  const losingSuper = patch.role != null && patch.role !== 'super_admin' && row.role === 'super_admin';
  if (becomingInactive || losingSuper) {
    if (row.role === 'super_admin' && activeSuperAdminCount() <= 1) {
      throw new Error('last_super_admin');
    }
  }
  // Guard: cannot disable yourself.
  if (becomingInactive && actorUsername && row.username === actorUsername) {
    throw new Error('cannot_disable_self');
  }

  const displayName = patch.displayName != null ? String(patch.displayName).trim().slice(0, 40) : row.display_name;
  const role = patch.role != null ? patch.role : row.role;
  const status = patch.status != null ? (patch.status === 'disabled' ? 'disabled' : 'active') : row.status;

  db.prepare(
    `UPDATE admin_users SET display_name = ?, role = ?, status = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(displayName || row.username, role, status, Number(id));

  if (patch.password) {
    if (String(patch.password).length < 6) throw new Error('weak_password');
    db.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`).run(hashPassword(patch.password), Number(id));
  }
  return getAdminUserById(Number(id));
}

export function resetAdminPassword(id, newPassword) {
  const db = getDb();
  const row = db.prepare('SELECT id FROM admin_users WHERE id = ?').get(Number(id));
  if (!row) throw new Error('not_found');
  assertCredential(newPassword, row.username);
  db.prepare(`UPDATE admin_users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`)
    .run(hashPassword(newPassword), Number(id));
  return { ok: true };
}

function activeSuperAdminCount() {
  const db = getDb();
  return db.prepare(
    `SELECT COUNT(*) AS c FROM admin_users WHERE role = 'super_admin' AND status = 'active'`
  ).get()?.c || 0;
}

/* ── Bootstrap: seed first super_admin from env on first boot ─────────── */

// Only used on first boot with an empty database.
// After that, admin accounts are managed entirely via the Admin UI.
export function ensureBootstrapAdmin() {
  const db = getDb();
  const count = db.prepare('SELECT COUNT(*) AS c FROM admin_users').get()?.c || 0;
  if (count > 0) return null;
  const password = process.env.ADMIN_PASSWORD || '';
  if (!password) return null;
  const username = process.env.ADMIN_USERNAME || 'admin';
  const displayName = process.env.ADMIN_DISPLAY_NAME || '超级管理员';
  const weak = checkCredentialStrength(password, username);
  if (weak) {
    // 只在首次初始化（空库）时发生。弱口令仍创建账号，但打印醒目告警，
    // 避免管理员被锁在门外，同时留下明确的安全提示。
    console.warn(
      '[security] ADMIN_PASSWORD is weak (%s): at least %d chars, no digits-only, not a common password. Change it in Admin → 账号管理.',
      weak, MIN_LENGTH
    );
  }
  db.prepare(
    `INSERT INTO admin_users (username, display_name, password_hash, role, status, created_by)
     VALUES (?, ?, ?, 'super_admin', 'active', 'bootstrap')`
  ).run(username, displayName, hashPassword(password));
  console.log('[adminUsers] bootstrap super_admin "%s" created from ADMIN_PASSWORD', username);
  return username;
}
