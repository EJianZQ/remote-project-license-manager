import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { env } from "../env";
import * as schema from "./schema";

function resolveSqlitePath(databaseUrl: string): string {
  if (databaseUrl === ":memory:") {
    return databaseUrl;
  }

  const filePath = databaseUrl.startsWith("file:")
    ? databaseUrl.slice("file:".length)
    : databaseUrl;

  return path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
}

const sqlitePath = resolveSqlitePath(env.DATABASE_URL);

if (sqlitePath !== ":memory:") {
  fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
}

export const sqlite = new Database(sqlitePath);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
