import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';
import { config } from '../config';

const dataDir = path.dirname(config.sqlitePath);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(config.uploadsDir)) {
  fs.mkdirSync(config.uploadsDir, { recursive: true });
}

let rawDb: SqlJsDatabase;

let inTransaction = false;

function saveDatabase() {
  if (rawDb && !inTransaction) {
    try {
      const data = rawDb.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(config.sqlitePath, buffer);
    } catch (err: any) {
      // In case export fails during rare wasm state
    }
  }
}

export const db = {
  exec(sql: string) {
    rawDb.exec(sql);
    saveDatabase();
  },
  prepare(sql: string) {
    return {
      get(...params: any[]) {
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        if (stmt.step()) {
          const row = stmt.getAsObject();
          stmt.free();
          return row;
        }
        stmt.free();
        return undefined;
      },
      all(...params: any[]) {
        const stmt = rawDb.prepare(sql);
        stmt.bind(params);
        const results: any[] = [];
        while (stmt.step()) {
          results.push(stmt.getAsObject());
        }
        stmt.free();
        return results;
      },
      run(...params: any[]) {
        const sanitizedParams = params.map(p => (p === undefined ? null : p));
        rawDb.run(sql, sanitizedParams);
        saveDatabase();
        return { changes: 1 };
      }
    };
  },
  transaction(fn: () => void) {
    return () => {
      if (inTransaction) {
        fn();
        return;
      }
      inTransaction = true;
      try {
        rawDb.exec('BEGIN TRANSACTION;');
        fn();
        try {
          rawDb.exec('COMMIT;');
        } catch (commitErr: any) {
          // If transaction was already finalized
        }
      } catch (e) {
        try {
          rawDb.exec('ROLLBACK;');
        } catch {
          // Transaction may have already been aborted or rolled back by SQLite
        }
        throw e;
      } finally {
        inTransaction = false;
        saveDatabase();
      }
    };
  }
};

export async function initDatabase() {
  const SQL = await initSqlJs();
  
  if (fs.existsSync(config.sqlitePath)) {
    const fileBuffer = fs.readFileSync(config.sqlitePath);
    rawDb = new SQL.Database(fileBuffer);
  } else {
    rawDb = new SQL.Database();
  }

  const schema = `
    -- Users Table
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      company_name TEXT,
      role TEXT DEFAULT 'USER',
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- WhatsApp Accounts Table (Dual Engine Support)
    CREATE TABLE IF NOT EXISTS whatsapp_accounts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_name TEXT NOT NULL,
      phone_number TEXT NOT NULL,
      provider_type TEXT NOT NULL,
      phone_number_id TEXT,
      waba_id TEXT,
      encrypted_access_token TEXT,
      session_id TEXT,
      gateway_url TEXT,
      encrypted_api_key TEXT,
      status TEXT DEFAULT 'DISCONNECTED',
      quality_rating TEXT DEFAULT 'UNKNOWN',
      last_connected_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, phone_number)
    );

    -- Uploaded Files
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      file_size_bytes INTEGER NOT NULL,
      row_count INTEGER DEFAULT 0,
      detected_columns TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Contacts Book
    CREATE TABLE IF NOT EXISTS contacts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      phone_e164 TEXT NOT NULL,
      formatted_name TEXT,
      is_opted_out INTEGER DEFAULT 0,
      opted_out_at TEXT,
      timezone TEXT DEFAULT 'Asia/Riyadh',
      metadata TEXT DEFAULT '{}',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(user_id, phone_e164)
    );

    -- Campaigns Table
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      whatsapp_account_id TEXT NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE RESTRICT,
      uploaded_file_id TEXT REFERENCES uploaded_files(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      status TEXT DEFAULT 'DRAFT',
      message_type TEXT DEFAULT 'TEXT',
      template_name TEXT,
      template_language TEXT DEFAULT 'ar',
      message_body TEXT,
      column_mapping TEXT DEFAULT '{}',
      send_delay_seconds INTEGER DEFAULT 10,
      jitter_min_seconds INTEGER DEFAULT 3,
      jitter_max_seconds INTEGER DEFAULT 8,
      respect_quiet_hours INTEGER DEFAULT 1,
      quiet_hours_start TEXT DEFAULT '23:00',
      quiet_hours_end TEXT DEFAULT '08:00',
      total_contacts INTEGER DEFAULT 0,
      sent_count INTEGER DEFAULT 0,
      delivered_count INTEGER DEFAULT 0,
      read_count INTEGER DEFAULT 0,
      failed_count INTEGER DEFAULT 0,
      scheduled_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Campaign Contacts
    CREATE TABLE IF NOT EXISTS campaign_contacts (
      id TEXT PRIMARY KEY,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      contact_id TEXT REFERENCES contacts(id) ON DELETE SET NULL,
      phone_e164 TEXT NOT NULL,
      custom_variables TEXT DEFAULT '{}',
      status TEXT DEFAULT 'PENDING',
      retry_count INTEGER DEFAULT 0,
      error_message TEXT,
      sent_at TEXT,
      delivered_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Messages Audit Trail
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      campaign_contact_id TEXT REFERENCES campaign_contacts(id) ON DELETE CASCADE,
      campaign_id TEXT NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
      whatsapp_account_id TEXT NOT NULL REFERENCES whatsapp_accounts(id) ON DELETE CASCADE,
      provider_message_id TEXT,
      direction TEXT DEFAULT 'OUTBOUND',
      recipient_phone TEXT NOT NULL,
      message_content TEXT NOT NULL,
      status TEXT DEFAULT 'PENDING',
      error_code TEXT,
      error_details TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );
  `;

  rawDb.exec(schema);
  saveDatabase();
}
