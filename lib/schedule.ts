// Pure scheduling logic: no I/O, fully unit-tested.
// Times are minutes from midnight; dates are "YYYY-MM-DD" strings (no time zones).

export const SLOT_MIN = 30;

export type Status = "free" | "maybe" | "busy";

/**
 * One day of a person's availability.
 * - `all` marks the whole day (every slot in the event's daily window).
 * - `slots` marks specific slots (key = slot start in minutes) and wins over `all`.
 * Anything unmarked is busy.
 */
export type DayAvail = { all?: Status; slots?: Record<string, Status> };
export type Avail = Record<string, DayAvail>;

export interface EventConfig {
  dateStart: string;
  dateEnd: string;
  dayStartMin: number;
  dayEndMin: number;
  durationMin: number;
}

export interface Participant {
  id: string;
  name: string;
  avail: Avail;
}

export interface TimeOption {
  date: string;
  start: number;
  end: number;
  /** Last start in a run of adjacent starts with the same attendees (== start if no run). */
  latestStart: number;
  free: { id: string; name: string }[];
  maybe: { id: string; name: string }[];
  no: { id: string; name: string }[];
  /** free + maybe */
  attendance: number;
}

export function dateRange(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T00:00:00Z");
  const last = new Date(end + "T00:00:00Z");
  if (isNaN(d.getTime()) || isNaN(last.getTime())) return out;
  while (d <= last) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export function slotStarts(dayStartMin: number, dayEndMin: number): number[] {
  const out: number[] = [];
  for (let m = dayStartMin; m + SLOT_MIN <= dayEndMin; m += SLOT_MIN) out.push(m);
  return out;
}

export function slotStatus(avail: Avail, date: string, min: number): Status {
  const day = avail[date];
  if (!day) return "busy";
  return day.slots?.[String(min)] ?? day.all ?? "busy";
}

/** Can this person attend an event of `durationMin` starting at `start`? */
export function evaluate(
  avail: Avail,
  date: string,
  start: number,
  durationMin: number,
): "free" | "maybe" | "no" {
  let sawMaybe = false;
  const end = start + durationMin;
  for (let m = start; m < end; m += SLOT_MIN) {
    const s = slotStatus(avail, date, m);
    if (s === "busy") return "no";
    if (s === "maybe") sawMaybe = true;
  }
  return sawMaybe ? "maybe" : "free";
}

const idsKey = (xs: { id: string }[]) =>
  xs.map((x) => x.id).sort().join(",");

/**
 * Rank candidate start times by how many people can attend (free or maybe),
 * not all-or-nothing. Ties: more "free" first, then earliest. Options where
 * nobody can attend are dropped. Adjacent starts with identical attendee sets
 * are collapsed into one option with a `latestStart`.
 */
export function rankOptions(cfg: EventConfig, participants: Participant[]): TimeOption[] {
  const raw: TimeOption[] = [];
  for (const date of dateRange(cfg.dateStart, cfg.dateEnd)) {
    for (
      let start = cfg.dayStartMin;
      start + cfg.durationMin <= cfg.dayEndMin;
      start += SLOT_MIN
    ) {
      const free: TimeOption["free"] = [];
      const maybe: TimeOption["maybe"] = [];
      const no: TimeOption["no"] = [];
      for (const p of participants) {
        const who = { id: p.id, name: p.name };
        const r = evaluate(p.avail, date, start, cfg.durationMin);
        (r === "free" ? free : r === "maybe" ? maybe : no).push(who);
      }
      if (free.length + maybe.length === 0) continue;
      raw.push({
        date,
        start,
        end: start + cfg.durationMin,
        latestStart: start,
        free,
        maybe,
        no,
        attendance: free.length + maybe.length,
      });
    }
  }

  const collapsed: TimeOption[] = [];
  for (const o of raw) {
    const prev = collapsed[collapsed.length - 1];
    if (
      prev &&
      prev.date === o.date &&
      prev.latestStart + SLOT_MIN === o.start &&
      idsKey(prev.free) === idsKey(o.free) &&
      idsKey(prev.maybe) === idsKey(o.maybe)
    ) {
      prev.latestStart = o.start;
    } else {
      collapsed.push(o);
    }
  }

  return collapsed.sort(
    (a, b) =>
      b.attendance - a.attendance ||
      b.free.length - a.free.length ||
      a.date.localeCompare(b.date) ||
      a.start - b.start,
  );
}

/** Is (date, start) a valid start time for this event? */
export function isValidStart(cfg: EventConfig, date: string, start: number): boolean {
  return (
    dateRange(cfg.dateStart, cfg.dateEnd).includes(date) &&
    Number.isInteger(start) &&
    start >= cfg.dayStartMin &&
    start + cfg.durationMin <= cfg.dayEndMin &&
    (start - cfg.dayStartMin) % SLOT_MIN === 0
  );
}

const isStatus = (s: unknown): s is Status => s === "free" || s === "maybe" || s === "busy";

/** Drop anything from untrusted input that isn't a valid date/slot/status for this event. */
export function sanitizeAvail(raw: unknown, cfg: EventConfig): Avail {
  const out: Avail = {};
  if (!raw || typeof raw !== "object") return out;
  const dates = new Set(dateRange(cfg.dateStart, cfg.dateEnd));
  const valid = new Set(slotStarts(cfg.dayStartMin, cfg.dayEndMin).map(String));
  for (const [date, day] of Object.entries(raw as Record<string, unknown>)) {
    if (!dates.has(date) || !day || typeof day !== "object") continue;
    const d = day as { all?: unknown; slots?: unknown };
    const clean: DayAvail = {};
    if (isStatus(d.all) && d.all !== "busy") clean.all = d.all;
    if (d.slots && typeof d.slots === "object") {
      const slots: Record<string, Status> = {};
      for (const [k, v] of Object.entries(d.slots as Record<string, unknown>)) {
        if (valid.has(k) && isStatus(v)) slots[k] = v;
      }
      if (Object.keys(slots).length) clean.slots = slots;
    }
    if (clean.all || clean.slots) out[date] = clean;
  }
  return out;
}

/** Return a copy of `avail` with one slot set. Expands a whole-day mark into slots first. */
export function setSlot(
  avail: Avail,
  date: string,
  min: number,
  status: Status,
  dayStartMin: number,
  dayEndMin: number,
): Avail {
  const day = avail[date] ?? {};
  const slots: Record<string, Status> = { ...(day.slots ?? {}) };
  if (day.all) {
    for (const m of slotStarts(dayStartMin, dayEndMin)) {
      if (!(String(m) in slots)) slots[String(m)] = day.all;
    }
  }
  if (status === "busy") delete slots[String(min)];
  else slots[String(min)] = status;
  const next = { ...avail };
  if (Object.keys(slots).length) next[date] = { slots };
  else delete next[date];
  return next;
}

/** Return a copy of `avail` with a whole day set (or cleared when busy). */
export function setAllDay(avail: Avail, date: string, status: Status): Avail {
  const next = { ...avail };
  if (status === "busy") delete next[date];
  else next[date] = { all: status };
  return next;
}
