import { DatabaseSync } from "node:sqlite";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  password TEXT,
  name TEXT NOT NULL,
  phone TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS events (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id INTEGER NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  duration_min INTEGER NOT NULL,
  date_start TEXT NOT NULL,
  date_end TEXT NOT NULL,
  day_start_min INTEGER NOT NULL,
  day_end_min INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  final_date TEXT,
  final_start_min INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS invites (
  event_id INTEGER NOT NULL REFERENCES events(id),
  phone TEXT NOT NULL,
  PRIMARY KEY (event_id, phone)
);
CREATE TABLE IF NOT EXISTS responses (
  id INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  owner_key TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id),
  name TEXT NOT NULL,
  avail TEXT NOT NULL DEFAULT '{}',
  has_availability INTEGER NOT NULL DEFAULT 0,
  rsvp TEXT,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (event_id, owner_key)
);
`;

const g = globalThis as unknown as { __ketchupDb?: DatabaseSync };

export function db(): DatabaseSync {
  if (!g.__ketchupDb) {
    const d = new DatabaseSync(process.env.DATABASE_PATH ?? "ketchup.db");
    d.exec("PRAGMA foreign_keys = ON");
    d.exec(SCHEMA);
    g.__ketchupDb = d;
  }
  return g.__ketchupDb;
}
