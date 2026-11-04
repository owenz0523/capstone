"use client";
import { fmtDate, fmtTime, fromTimeInput, toTimeInput } from "@/lib/format";
import type { Avail, DayAvail, Range, Status } from "@/lib/schedule";

/** Returns an error message if any range is empty/backwards, else null. */
export function availError(avail: Avail): string | null {
  for (const [date, day] of Object.entries(avail)) {
    for (const r of day.ranges ?? []) {
      if (r.end <= r.start) return `${fmtDate(date)}: a time range ends before it starts.`;
    }
  }
  return null;
}

export default function AvailabilityEditor({
  dates, dayStartMin, dayEndMin, durationMin, value, onChange,
}: {
  dates: string[]; dayStartMin: number; dayEndMin: number; durationMin: number;
  value: Avail; onChange: (v: Avail) => void;
}) {
  const setDay = (date: string, day: DayAvail | undefined) => {
    const next = { ...value };
    if (day && (day.all || day.ranges?.length)) next[date] = day;
    else delete next[date];
    onChange(next);
  };

  const setRange = (date: string, i: number, patch: Partial<Range>) => {
    const ranges = (value[date]?.ranges ?? []).map((r, j) => (j === i ? { ...r, ...patch } : r));
    setDay(date, { ranges });
  };

  const addRange = (date: string) => {
    const day = value[date] ?? {};
    // Turning "all day" into an editable range keeps what they had selected.
    const existing: Range[] = day.all
      ? [{ start: dayStartMin, end: dayEndMin, status: day.all }]
      : (day.ranges ?? []);
    const last = existing[existing.length - 1];
    const start = last ? Math.min(last.end, dayEndMin - 1) : dayStartMin;
    const end = Math.min(start + Math.max(durationMin, 60), dayEndMin);
    setDay(date, { ranges: [...existing, { start, end, status: "free" }] });
  };

  return (
    <div className="avail-days">
      <p className="muted small" style={{ margin: 0 }}>
        For each day, add the times you&apos;re free (or &quot;maybe&quot;). Use any start and end time you like.
        Days you leave empty count as busy. Guests can pick between {fmtTime(dayStartMin)} and {fmtTime(dayEndMin)}.
      </p>
      {dates.map((date, idx) => {
        const day = value[date] ?? {};
        const ranges = day.ranges ?? [];
        const prev = idx > 0 ? value[dates[idx - 1]] : undefined;
        return (
          <section key={date} className={`day-card ${day.all || ranges.length ? "has" : ""}`}>
            <div className="row" style={{ flexWrap: "wrap" }}>
              <strong>{fmtDate(date)}</strong>
              <div className="chips">
                <button type="button" className={`chip sm ${day.all === "free" ? "on" : ""}`}
                  onClick={() => setDay(date, day.all === "free" ? undefined : { all: "free" })}>
                  Free all day
                </button>
                <button type="button" className={`chip sm ${day.all === "maybe" ? "on" : ""}`}
                  onClick={() => setDay(date, day.all === "maybe" ? undefined : { all: "maybe" })}>
                  Maybe all day
                </button>
                {prev && (prev.all || prev.ranges?.length) && (
                  <button type="button" className="chip sm" onClick={() => setDay(date, structuredClone(prev))}>
                    Copy previous day
                  </button>
                )}
              </div>
            </div>

            {day.all && (
              <p className={`small ${day.all === "free" ? "t-free" : "t-maybe"}`} style={{ margin: 0 }}>
                {day.all === "free" ? "Free" : "Maybe"} all day ({fmtTime(dayStartMin)} – {fmtTime(dayEndMin)})
              </p>
            )}

            {ranges.map((r, i) => (
              <div key={i} className="range-row">
                <select
                  className={`input status-select ${r.status === "free" ? "t-free" : "t-maybe"}`}
                  value={r.status}
                  aria-label="Free or maybe"
                  onChange={(e) => setRange(date, i, { status: e.target.value as Status })}
                >
                  <option value="free">Free</option>
                  <option value="maybe">Maybe</option>
                </select>
                <input
                  className="input" type="time" required aria-label="From"
                  value={toTimeInput(r.start)}
                  min={toTimeInput(dayStartMin)} max={toTimeInput(dayEndMin)}
                  onChange={(e) => { const v = fromTimeInput(e.target.value); if (v != null) setRange(date, i, { start: v }); }}
                />
                <span className="muted">to</span>
                <input
                  className="input" type="time" required aria-label="To"
                  value={toTimeInput(r.end)}
                  min={toTimeInput(dayStartMin)} max={toTimeInput(dayEndMin)}
                  onChange={(e) => { const v = fromTimeInput(e.target.value); if (v != null) setRange(date, i, { end: v }); }}
                />
                <button type="button" className="icon-btn" aria-label="Remove time range"
                  onClick={() => setDay(date, { ranges: ranges.filter((_, j) => j !== i) })}>
                  ×
                </button>
                {r.end <= r.start && <span className="error small range-err">Must end after it starts</span>}
              </div>
            ))}

            <div>
              <button type="button" className="btn add-range" onClick={() => addRange(date)}>+ Add a time range</button>
            </div>
          </section>
        );
      })}
    </div>
  );
}
