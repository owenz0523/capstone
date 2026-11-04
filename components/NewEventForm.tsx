"use client";
import { useActionState } from "react";
import Link from "next/link";
import { createEventAction } from "@/app/actions";
import { fmtHour } from "@/lib/format";

const durations = Array.from({ length: 16 }, (_, i) => (i + 1) * 30);
const hours = Array.from({ length: 25 }, (_, i) => i);
const label = (m: number) => `${m >= 60 ? Math.floor(m / 60) + " hr" : ""}${m % 60 ? ` ${m % 60} min`.trimStart() : ""}`.trim();

export default function NewEventForm({ today, weekAhead }: { today: string; weekAhead: string }) {
  const [state, action, pending] = useActionState(createEventAction, null);
  return (
    <form action={action} className="card" style={{ display: "grid", gap: 18 }}>
      <label className="field">
        Event title
        <input className="input" name="title" placeholder="e.g. End-of-term dinner" required maxLength={100} />
      </label>
      <label className="field">
        How long will it be?
        <select className="input" name="duration" defaultValue={120}>
          {durations.map((d) => <option key={d} value={d}>{label(d)}</option>)}
        </select>
      </label>
      <fieldset className="field-group">
        <legend>Date window (up to 14 days)</legend>
        <label className="field">First date<input className="input" type="date" name="dateStart" defaultValue={today} min={today} required /></label>
        <label className="field">Last date<input className="input" type="date" name="dateEnd" defaultValue={weekAhead} min={today} required /></label>
      </fieldset>
      <fieldset className="field-group">
        <legend>Times of day guests can pick from</legend>
        <label className="field">Earliest
          <select className="input" name="dayStartHour" defaultValue={9}>
            {hours.slice(0, 24).map((h) => <option key={h} value={h}>{fmtHour(h * 60)}</option>)}
          </select>
        </label>
        <label className="field">Latest end
          <select className="input" name="dayEndHour" defaultValue={22}>
            {hours.slice(1).map((h) => <option key={h} value={h}>{h === 24 ? "12 AM (midnight)" : fmtHour(h * 60)}</option>)}
          </select>
        </label>
      </fieldset>
      <label className="field">
        Invite people by phone number (optional)
        <textarea className="input" name="phones" rows={3} placeholder="(519) 555-1234, 416-555-0000" style={{ padding: 12 }} />
        <span className="muted small">They&apos;ll see the event on their home screen when they sign in. You&apos;ll also get a link to share with anyone.</span>
      </label>
      {state?.error && <p className="error" role="alert">{state.error}</p>}
      <div className="row">
        <Link className="btn" href="/home">Cancel</Link>
        <button className="btn btn-primary" disabled={pending}>{pending ? "Creating…" : "Create event"}</button>
      </div>
    </form>
  );
}
