import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

export function openDatabase(path) {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;");
  return db;
}

export function migrate(db) {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL,
    checksum TEXT NOT NULL
  )`);
  const files = readdirSync(resolve(root, "migrations")).filter((name) => name.endsWith(".sql")).sort();
  const appliedRows = db.prepare("SELECT version, checksum FROM schema_migrations").all();
  const applied = new Map(appliedRows.map((row) => [row.version, row.checksum]));
  const insert = db.prepare("INSERT INTO schema_migrations(version, applied_at, checksum) VALUES (?, ?, ?)");
  for (const file of files) {
    const sql = readFileSync(resolve(root, "migrations", file), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    if (applied.has(file)) {
      if (applied.get(file) !== checksum) throw new Error(`Applied migration checksum mismatch: ${file}`);
      continue;
    }
    db.exec("BEGIN IMMEDIATE");
    try {
      db.exec(sql);
      insert.run(file, new Date().toISOString(), checksum);
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }
  return files;
}
