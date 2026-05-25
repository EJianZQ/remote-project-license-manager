import { sqlite } from "./index";

sqlite.exec(`
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  public_key TEXT NOT NULL UNIQUE,
  enabled INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'grace', 'expired', 'suspended')),
  expires_at TEXT,
  popup_enabled INTEGER NOT NULL DEFAULT 0,
  popup_title TEXT,
  popup_content TEXT,
  popup_level TEXT NOT NULL DEFAULT 'warning' CHECK (popup_level IN ('info', 'warning', 'danger')),
  variables_json TEXT NOT NULL DEFAULT '{}',
  allowed_domains_json TEXT NOT NULL DEFAULT '[]',
  remarks TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS projects_slug_unique ON projects (slug);
CREATE UNIQUE INDEX IF NOT EXISTS projects_public_key_unique ON projects (public_key);
CREATE INDEX IF NOT EXISTS projects_deleted_at_idx ON projects (deleted_at);

UPDATE projects
SET
  slug = slug || '__deleted__' || id,
  public_key = public_key || '__deleted__' || id
WHERE deleted_at IS NOT NULL
  AND slug NOT LIKE '%__deleted__' || id;

CREATE TABLE IF NOT EXISTS project_access_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER,
  slug TEXT NOT NULL,
  public_key TEXT,
  request_domain TEXT,
  origin TEXT,
  referer TEXT,
  ip TEXT,
  user_agent TEXT,
  effective_status TEXT CHECK (
    effective_status IS NULL OR effective_status IN ('active', 'grace', 'expired', 'suspended')
  ),
  allowed INTEGER NOT NULL,
  message TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS project_access_logs_project_id_idx ON project_access_logs (project_id);
CREATE INDEX IF NOT EXISTS project_access_logs_slug_idx ON project_access_logs (slug);
CREATE INDEX IF NOT EXISTS project_access_logs_created_at_idx ON project_access_logs (created_at);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT
);

CREATE INDEX IF NOT EXISTS admin_sessions_username_idx ON admin_sessions (username);
CREATE INDEX IF NOT EXISTS admin_sessions_expires_at_idx ON admin_sessions (expires_at);
CREATE INDEX IF NOT EXISTS admin_sessions_revoked_at_idx ON admin_sessions (revoked_at);

CREATE TABLE IF NOT EXISTS admin_action_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id INTEGER,
  before_json TEXT,
  after_json TEXT,
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS admin_action_logs_action_idx ON admin_action_logs (action);
CREATE INDEX IF NOT EXISTS admin_action_logs_target_idx ON admin_action_logs (target_type, target_id);
CREATE INDEX IF NOT EXISTS admin_action_logs_created_at_idx ON admin_action_logs (created_at);
`);

console.log("Database migration completed.");
