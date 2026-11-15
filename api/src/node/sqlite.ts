import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import type { Database, SqlValue } from '../platform';

/** node:sqlite (built into Node 22.13+), so the self-hosted server has no native dependencies. */
export class SqliteStore implements Database {
  private db: DatabaseSync;

  constructor(path: string) {
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
  }

  async first<T>(sql: string, ...args: SqlValue[]) {
    return (this.db.prepare(sql).get(...args) as T | undefined) ?? null;
  }
  async all<T>(sql: string, ...args: SqlValue[]) {
    return this.db.prepare(sql).all(...args) as T[];
  }
  async run(sql: string, ...args: SqlValue[]) {
    return Number(this.db.prepare(sql).run(...args).changes);
  }
  async batch(statements: { sql: string; args: SqlValue[] }[]) {
    this.db.exec('BEGIN');
    try {
      for (const s of statements) this.db.prepare(s.sql).run(...s.args);
      this.db.exec('COMMIT');
    } catch (err) {
      this.db.exec('ROLLBACK');
      throw err;
    }
  }

  /** Applies migrations/*.sql in name order, once each. Same files wrangler applies to D1. */
  migrate(dir: string) {
    this.db.exec('CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at INTEGER NOT NULL)');
    const applied = new Set(
      (this.db.prepare('SELECT name FROM _migrations').all() as { name: string }[]).map((r) => r.name),
    );
    for (const name of readdirSync(dir)
      .filter((f) => f.endsWith('.sql'))
      .sort()) {
      if (applied.has(name)) continue;
      this.db.exec('BEGIN');
      try {
        this.db.exec(readFileSync(join(dir, name), 'utf8'));
        this.db.prepare('INSERT INTO _migrations (name, applied_at) VALUES (?, ?)').run(name, Date.now());
        this.db.exec('COMMIT');
        console.log(`Applied migration ${name}`);
      } catch (err) {
        this.db.exec('ROLLBACK');
        throw err;
      }
    }
  }
}
