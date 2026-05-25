import { InferInsertModel, InferSelectModel } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

export const projectStatusValues = [
  "active",
  "grace",
  "expired",
  "suspended"
] as const;

export const popupLevelValues = ["info", "warning", "danger"] as const;

export type ProjectStatus = (typeof projectStatusValues)[number];
export type PopupLevel = (typeof popupLevelValues)[number];

export const projects = sqliteTable(
  "projects",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    publicKey: text("public_key").notNull(),
    enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
    status: text("status", { enum: projectStatusValues })
      .notNull()
      .default("active"),
    expiresAt: text("expires_at"),
    popupEnabled: integer("popup_enabled", { mode: "boolean" })
      .notNull()
      .default(false),
    popupTitle: text("popup_title"),
    popupContent: text("popup_content"),
    popupLevel: text("popup_level", { enum: popupLevelValues })
      .notNull()
      .default("warning"),
    variablesJson: text("variables_json").notNull().default("{}"),
    allowedDomainsJson: text("allowed_domains_json").notNull().default("[]"),
    remarks: text("remarks"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at")
  },
  (table) => ({
    slugIdx: uniqueIndex("projects_slug_unique").on(table.slug),
    publicKeyIdx: uniqueIndex("projects_public_key_unique").on(table.publicKey),
    deletedAtIdx: index("projects_deleted_at_idx").on(table.deletedAt)
  })
);

export const projectAccessLogs = sqliteTable(
  "project_access_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    projectId: integer("project_id"),
    slug: text("slug").notNull(),
    publicKey: text("public_key"),
    requestDomain: text("request_domain"),
    origin: text("origin"),
    referer: text("referer"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    effectiveStatus: text("effective_status", { enum: projectStatusValues }),
    allowed: integer("allowed", { mode: "boolean" }).notNull(),
    message: text("message"),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    projectIdIdx: index("project_access_logs_project_id_idx").on(table.projectId),
    slugIdx: index("project_access_logs_slug_idx").on(table.slug),
    createdAtIdx: index("project_access_logs_created_at_idx").on(table.createdAt)
  })
);

export const adminSessions = sqliteTable(
  "admin_sessions",
  {
    id: text("id").primaryKey(),
    username: text("username").notNull(),
    issuedAt: text("issued_at").notNull(),
    expiresAt: text("expires_at").notNull(),
    revokedAt: text("revoked_at")
  },
  (table) => ({
    usernameIdx: index("admin_sessions_username_idx").on(table.username),
    expiresAtIdx: index("admin_sessions_expires_at_idx").on(table.expiresAt),
    revokedAtIdx: index("admin_sessions_revoked_at_idx").on(table.revokedAt)
  })
);

export const adminActionLogs = sqliteTable(
  "admin_action_logs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: integer("target_id"),
    beforeJson: text("before_json"),
    afterJson: text("after_json"),
    ip: text("ip"),
    userAgent: text("user_agent"),
    createdAt: text("created_at").notNull()
  },
  (table) => ({
    actionIdx: index("admin_action_logs_action_idx").on(table.action),
    targetIdx: index("admin_action_logs_target_idx").on(
      table.targetType,
      table.targetId
    ),
    createdAtIdx: index("admin_action_logs_created_at_idx").on(table.createdAt)
  })
);

export type ProjectRecord = InferSelectModel<typeof projects>;
export type NewProjectRecord = InferInsertModel<typeof projects>;
export type ProjectAccessLogRecord = InferSelectModel<typeof projectAccessLogs>;
export type AdminSessionRecord = InferSelectModel<typeof adminSessions>;
export type AdminActionLogRecord = InferSelectModel<typeof adminActionLogs>;
