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

export const PREF_ACTIVITIES = ["Food", "Coffee / dessert", "Board games", "Movies", "Outdoors", "Arcade / bowling"];
export const PREF_BUDGETS = ["Under $15", "$15–30", "$30–50", "$50+"];
export const PREF_DIET = ["Vegetarian", "Vegan", "Halal", "Kosher", "Gluten-free", "Nut allergy"];
