import { Injectable } from '@angular/core';
import { Capacitor } from '@capacitor/core';

@Injectable({ providedIn: 'root' })
export class DatabaseService {
  readonly isNative = Capacitor.isNativePlatform();
  private db: any = null;
  private _isReady = false;

  async init(): Promise<void> {
    if (!this.isNative || this._isReady) return;
    try {
      const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
      const sqlite = new SQLiteConnection(CapacitorSQLite);
      this.db = await sqlite.createConnection('mcf', false, 'no-encryption', 1, false);
      await this.db.open();
      await this.createTables();
      this._isReady = true;
    } catch (e) {
      console.warn('[DB] SQLite init failed, using localStorage fallback', e);
    }
  }

  private async createTables(): Promise<void> {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
        category TEXT, due_day INTEGER, default_amount REAL DEFAULT 0,
        financial_account_id TEXT, active INTEGER DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS financial_accounts (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
        opening_balance REAL DEFAULT 0, active INTEGER DEFAULT 1
      )`,
      `CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL, financial_account_id TEXT,
        month TEXT NOT NULL, amount REAL NOT NULL, status TEXT NOT NULL,
        kind TEXT NOT NULL, notes TEXT, generated_from_recurring INTEGER DEFAULT 0
      )`,
      `CREATE TABLE IF NOT EXISTS debts (
        id TEXT PRIMARY KEY, account_id TEXT NOT NULL,
        original_amount REAL NOT NULL, current_balance REAL NOT NULL,
        installment_amount REAL NOT NULL, remaining_installments INTEGER NOT NULL,
        interest_rate REAL DEFAULT 0, start_month TEXT, end_month TEXT
      )`,
      `CREATE TABLE IF NOT EXISTS incomes (
        id TEXT PRIMARY KEY, month TEXT NOT NULL, description TEXT,
        amount REAL NOT NULL, recurring INTEGER DEFAULT 0
      )`,
    ];
    for (const sql of stmts) {
      await this.db.execute(sql);
    }
  }

  async execute(sql: string, params: (string | number | null)[] = []): Promise<void> {
    if (!this.db) return;
    await this.db.run(sql, params);
  }

  async query<T>(sql: string, params: (string | number | null)[] = []): Promise<T[]> {
    if (!this.db) return [];
    const result = await this.db.query(sql, params);
    return (result.values ?? []) as T[];
  }

  get isReady(): boolean { return this._isReady; }
}
