export function fmtTime(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h % 12 || 12}${m ? ":" + String(m).padStart(2, "0") : ":00"} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtHour(min: number): string {
  const h = Math.floor(min / 60) % 24;
  return `${h % 12 || 12} ${h >= 12 ? "PM" : "AM"}`;
}

export function fmtDate(d: string, long = false): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: long ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return [h ? `${h} hr` : "", m ? `${m} min` : ""].filter(Boolean).join(" ");
}

export const fmtRange = (start: number, end: number) => `${fmtTime(start)} – ${fmtTime(end)}`;


/** minutes <-> the "HH:MM" strings used by <input type="time"> */
export const toTimeInput = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
export function fromTimeInput(s: string): number | null {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
}
