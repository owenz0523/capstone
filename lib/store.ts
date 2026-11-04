import crypto from "node:crypto";
import { db } from "./db";
import type { Avail } from "./schedule";

export type User = { id: number; name: string; phone: string };

export type EventRow = {
  id: number;
  code: string;
  hostId: number;
  hostName: string;
  title: string;
  durationMin: number;
  dateStart: string;
  dateEnd: string;
  dayStartMin: number;
  dayEndMin: number;
  status: "open" | "confirmed";
  finalDate: string | null;
  finalStartMin: number | null;
};

export type ResponseRow = {
  id: number;
  ownerKey: string;
  userId: number | null;
  phone: string | null;
  name: string;
  avail: Avail;
  hasAvailability: boolean;
  activities: string[];
  budget: string;
  diet: string[];
  rsvp: "going" | "not_going" | null;
};

type Row = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

const EVENT_SELECT = `
  SELECT e.id, e.code, e.host_id AS hostId, u.name AS hostName, e.title,
         e.duration_min AS durationMin, e.date_start AS dateStart, e.date_end AS dateEnd,
         e.day_start_min AS dayStartMin, e.day_end_min AS dayEndMin, e.status,
         e.final_date AS finalDate, e.final_start_min AS finalStartMin
  FROM events e JOIN users u ON u.id = e.host_id`;

const plain = <T>(r: unknown) => (r ? ({ ...(r as object) } as T) : null);

// ---- users ----
// Prototype only: passwords are stored and compared as plain text.
export function createUser(name: string, phone: string, password: string): User | null {
  const d = db();
  if (d.prepare("SELECT 1 FROM users WHERE phone = ?").get(phone)) return null;
  const r = d.prepare("INSERT INTO users (name, phone, password) VALUES (?, ?, ?)").run(name, phone, password);
  return { id: Number(r.lastInsertRowid), name, phone };
}

export function authenticate(phone: string, password: string): User | null {
  const row = plain<User & { password: string | null }>(
    db().prepare("SELECT id, name, phone, password FROM users WHERE phone = ?").get(phone),
  );
  if (!row || row.password == null || row.password !== password) return null;
  return { id: row.id, name: row.name, phone: row.phone };
}

export function getUser(id: number): User | null {
  return plain<User>(db().prepare("SELECT id, name, phone FROM users WHERE id = ?").get(id));
}

// ---- events ----
export function createEvent(input: {
  hostId: number;
  title: string;
  durationMin: number;
  dateStart: string;
  dateEnd: string;
  dayStartMin: number;
  dayEndMin: number;
  invitePhones: string[];
}): string {
  const d = db();
  const code = crypto.randomBytes(5).toString("base64url");
  const r = d
    .prepare(
      `INSERT INTO events (code, host_id, title, duration_min, date_start, date_end, day_start_min, day_end_min)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(code, input.hostId, input.title, input.durationMin, input.dateStart, input.dateEnd, input.dayStartMin, input.dayEndMin);
  addInvites(Number(r.lastInsertRowid), input.invitePhones);
  return code;
}

export function addInvites(eventId: number, phones: string[]) {
  const stmt = db().prepare("INSERT OR IGNORE INTO invites (event_id, phone) VALUES (?, ?)");
  for (const p of phones) stmt.run(eventId, p);
}

export function getEventByCode(code: string): EventRow | null {
  return plain<EventRow>(db().prepare(`${EVENT_SELECT} WHERE e.code = ?`).get(code));
}

export function listHosted(userId: number): EventRow[] {
  return db()
    .prepare(`${EVENT_SELECT} WHERE e.host_id = ? ORDER BY e.created_at DESC, e.id DESC`)
    .all(userId)
    .map((r) => plain<EventRow>(r)!);
}

/** Events the user was invited to by phone number, or has responded to, excluding ones they host. */
export function listInvited(user: User): EventRow[] {
  return db()
    .prepare(
      `${EVENT_SELECT}
       WHERE e.host_id != ?1 AND (
         e.id IN (SELECT event_id FROM invites WHERE phone = ?2)
         OR e.id IN (SELECT event_id FROM responses WHERE user_id = ?1))
       ORDER BY e.created_at DESC, e.id DESC`,
    )
    .all(user.id, user.phone)
    .map((r) => plain<EventRow>(r)!);
}

export function confirmEvent(eventId: number, date: string, startMin: number) {
  db()
    .prepare("UPDATE events SET status = 'confirmed', final_date = ?, final_start_min = ? WHERE id = ?")
    .run(date, startMin, eventId);
}

export function listInvitePhones(eventId: number): string[] {
  return db()
    .prepare("SELECT phone FROM invites WHERE event_id = ? ORDER BY rowid")
    .all(eventId)
    .map((r) => (r as Row).phone as string);
}

// ---- responses ----
function mapResponse(r: Row): ResponseRow {
  return {
    id: r.id,
    ownerKey: r.ownerKey,
    userId: r.userId,
    phone: r.phone,
    name: r.name,
    avail: JSON.parse(r.avail),
    hasAvailability: !!r.hasAvailability,
    activities: JSON.parse(r.activities),
    budget: r.budget,
    diet: JSON.parse(r.diet),
    rsvp: r.rsvp,
  };
}

const RESPONSE_SELECT = `
  SELECT r.id, r.owner_key AS ownerKey, r.user_id AS userId, u.phone AS phone, r.name, r.avail,
         r.has_availability AS hasAvailability, r.activities, r.budget, r.diet, r.rsvp
  FROM responses r LEFT JOIN users u ON u.id = r.user_id`;

export function listResponses(eventId: number): ResponseRow[] {
  return db()
    .prepare(`${RESPONSE_SELECT} WHERE r.event_id = ? ORDER BY r.id`)
    .all(eventId)
    .map((r) => mapResponse(r as Row));
}

export function getResponse(eventId: number, ownerKey: string): ResponseRow | null {
  const r = db().prepare(`${RESPONSE_SELECT} WHERE r.event_id = ? AND r.owner_key = ?`).get(eventId, ownerKey);
  return r ? mapResponse(r as Row) : null;
}

export function saveResponse(input: {
  eventId: number;
  ownerKey: string;
  userId: number | null;
  name: string;
  avail: Avail;
  activities: string[];
  budget: string;
  diet: string[];
}) {
  db()
    .prepare(
      `INSERT INTO responses (event_id, owner_key, user_id, name, avail, has_availability, activities, budget, diet)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)
       ON CONFLICT (event_id, owner_key) DO UPDATE SET
         name = excluded.name, avail = excluded.avail, has_availability = 1,
         activities = excluded.activities, budget = excluded.budget, diet = excluded.diet,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .run(
      input.eventId, input.ownerKey, input.userId, input.name,
      JSON.stringify(input.avail), JSON.stringify(input.activities), input.budget, JSON.stringify(input.diet),
    );
}

export function saveRsvp(input: {
  eventId: number;
  ownerKey: string;
  userId: number | null;
  name: string;
  rsvp: "going" | "not_going";
}) {
  db()
    .prepare(
      `INSERT INTO responses (event_id, owner_key, user_id, name, rsvp) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT (event_id, owner_key) DO UPDATE SET rsvp = excluded.rsvp`,
    )
    .run(input.eventId, input.ownerKey, input.userId, input.name, input.rsvp);
}
