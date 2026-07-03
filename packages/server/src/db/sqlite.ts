import { db } from './pool.js';
import { randomUUID } from 'crypto';

export function generateUUID(): string {
  return randomUUID();
}

export function toJSON(obj: unknown): string {
  return JSON.stringify(obj);
}

export function fromJSON<T>(str: string | null | undefined): T | null {
  if (!str) return null;
  try { return JSON.parse(str) as T; } catch { return null; }
}

export function toArray(arr: unknown[]): string {
  return JSON.stringify(arr || []);
}

export function fromArray<T>(str: string | null | undefined): T[] {
  if (!str) return [];
  try { return JSON.parse(str) as T[]; } catch { return []; }
}

export function toISODate(date?: Date | null): string | null {
  if (!date) return null;
  return date.toISOString();
}

export function fromISODate(str: string | null | undefined): Date | null {
  if (!str) return null;
  return new Date(str);
}

export function transaction<T>(fn: () => T): T {
  return db.transaction(fn)();
}

export function batchInsert(table: string, columns: string[], rows: unknown[][]): void {
  const placeholders = columns.map(() => '?').join(', ');
  const stmt = db.prepare(`INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})`);
  const insertMany = db.transaction((items: unknown[][]) => {
    for (const row of items) stmt.run(...row);
  });
  insertMany(rows);
}

export { db };
