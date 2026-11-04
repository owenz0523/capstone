// Pure scheduling logic: no I/O, fully unit-tested.
// Times are minutes from midnight; dates are "YYYY-MM-DD" strings (no time zones).
// Availability is free-form time ranges per day, so durations and start times can be anything.

export type Status = "free" | "maybe";

export type Range = { start: number; end: number; status: Status };

/**
 * One day of a person's availability. Anything not covered is busy.
 * - `all` covers the whole daily window the host allowed.
 * - `ranges` are arbitrary [start, end) windows. Where they overlap, free beats maybe.
 */
export type DayAvail = { all?: Status; ranges?: Range[] };
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
  /** Last start in a run of consecutive starts with the same attendees (== start if no run). */
  latestStart: number;
  free: { id: string; name: string }[];
  maybe: { id: string; name: string }[];
  no: { id: string; name: string }[];
  /** free + maybe */
  attendance: number;
}

/** Start times are also tried on this grid so options land on round times (e.g. 6:15 PM). */
const SEARCH_STEP_MIN = 15;
const MAX_RANGES_PER_DAY = 24;

type Window = Pick<EventConfig, "dayStartMin" | "dayEndMin">;
type Segment = Range;

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

/** Flatten a day into sorted, non-overlapping segments (free wins over maybe where they overlap). */
export function segments(day: DayAvail | undefined, win: Window): Segment[] {
  if (!day) return [];
  const raw: Range[] = [...(day.ranges ?? [])];
  if (day.all) raw.push({ start: win.dayStartMin, end: win.dayEndMin, status: day.all });
  const points = [...new Set(raw.flatMap((r) => [r.start, r.end]))].sort((a, b) => a - b);
  const out: Segment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const a = points[i];
    const b = points[i + 1];
    const cover = raw.filter((r) => r.start <= a && r.end >= b);
    if (!cover.length) continue;
    const status: Status = cover.some((r) => r.status === "free") ? "free" : "maybe";
    const prev = out[out.length - 1];
    if (prev && prev.end === a && prev.status === status) prev.end = b;
    else out.push({ start: a, end: b, status });
  }
  return out;
}

/** Can this person attend [start, end) on `date`? Every minute must be covered. */
export function evaluate(
  avail: Avail,
  date: string,
  start: number,
  end: number,
  win: Window,
): "free" | "maybe" | "no" {
  let cursor = start;
  let sawMaybe = false;
  for (const s of segments(avail[date], win)) {
    if (s.end <= cursor) continue;
    if (s.start >= end) break;
    if (s.start > cursor) return "no"; // gap
    if (s.status === "maybe") sawMaybe = true;
    cursor = s.end;
    if (cursor >= end) break;
  }
  if (cursor < end) return "no";
  return sawMaybe ? "maybe" : "free";
}

const idsKey = (xs: { id: string }[]) => xs.map((x) => x.id).sort().join(",");

/**
 * Rank candidate start times by how many people can attend (free or maybe),
 * not all-or-nothing. Ties: more "free" first, then earliest. Options where
 * nobody can attend are dropped. Consecutive starts with identical attendees
 * collapse into one option with a `latestStart`.
 */
export function rankOptions(cfg: EventConfig, participants: Participant[]): TimeOption[] {
  const lastStart = cfg.dayEndMin - cfg.durationMin;
  const collapsed: TimeOption[] = [];

  for (const date of dateRange(cfg.dateStart, cfg.dateEnd)) {
    // Candidates: a regular grid plus every point where someone's availability begins or
    // stops fitting, so we never miss the exact edge of an overlap.
    const cand = new Set<number>();
    for (let s = cfg.dayStartMin; s <= lastStart; s += SEARCH_STEP_MIN) cand.add(s);
    if (lastStart >= cfg.dayStartMin) cand.add(lastStart);
    for (const p of participants) {
      for (const seg of segments(p.avail[date], cfg)) {
        cand.add(seg.start);
        cand.add(seg.end - cfg.durationMin);
      }
    }
    const starts = [...cand]
      .filter((s) => Number.isInteger(s) && s >= cfg.dayStartMin && s <= lastStart)
      .sort((a, b) => a - b);

    let prev: TimeOption | undefined;
    for (const start of starts) {
      const free: TimeOption["free"] = [];
      const maybe: TimeOption["maybe"] = [];
      const no: TimeOption["no"] = [];
      for (const p of participants) {
        const who = { id: p.id, name: p.name };
        const r = evaluate(p.avail, date, start, start + cfg.durationMin, cfg);
        (r === "free" ? free : r === "maybe" ? maybe : no).push(who);
      }
      if (free.length + maybe.length === 0) {
        prev = undefined;
        continue;
      }
      if (prev && idsKey(prev.free) === idsKey(free) && idsKey(prev.maybe) === idsKey(maybe)) {
        prev.latestStart = start;
        continue;
      }
      prev = {
        date,
        start,
        end: start + cfg.durationMin,
        latestStart: start,
        free,
        maybe,
        no,
        attendance: free.length + maybe.length,
      };
      collapsed.push(prev);
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

/** Is (date, start) a valid start time for this event? Any minute is fine. */
export function isValidStart(cfg: EventConfig, date: string, start: number): boolean {
  return (
    dateRange(cfg.dateStart, cfg.dateEnd).includes(date) &&
    Number.isInteger(start) &&
    start >= cfg.dayStartMin &&
    start + cfg.durationMin <= cfg.dayEndMin
  );
}

const isStatus = (s: unknown): s is Status => s === "free" || s === "maybe";

/** Drop/clamp anything from untrusted input that isn't a valid date, range or status for this event. */
export function sanitizeAvail(raw: unknown, cfg: EventConfig): Avail {
  const out: Avail = {};
  if (!raw || typeof raw !== "object") return out;
  const dates = new Set(dateRange(cfg.dateStart, cfg.dateEnd));
  for (const [date, day] of Object.entries(raw as Record<string, unknown>)) {
    if (!dates.has(date) || !day || typeof day !== "object") continue;
    const d = day as { all?: unknown; ranges?: unknown };
    const clean: DayAvail = {};
    if (isStatus(d.all)) clean.all = d.all;
    if (Array.isArray(d.ranges)) {
      const ranges: Range[] = [];
      for (const r of d.ranges.slice(0, MAX_RANGES_PER_DAY)) {
        if (!r || typeof r !== "object") continue;
        const { start, end, status } = r as Record<string, unknown>;
        if (!isStatus(status) || !Number.isInteger(start) || !Number.isInteger(end)) continue;
        const s = Math.max(start as number, cfg.dayStartMin);
        const e = Math.min(end as number, cfg.dayEndMin);
        if (s < e) ranges.push({ start: s, end: e, status });
      }
      if (ranges.length) clean.ranges = ranges;
    }
    if (clean.all || clean.ranges) out[date] = clean;
  }
  return out;
}
