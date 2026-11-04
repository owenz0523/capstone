"use client";
import { useActionState } from "react";
import Link from "next/link";
import { createEventAction } from "@/app/actions";

export default function NewEventForm({ today, weekAhead }: { today: string; weekAhead: string }) {
  const [state, action, pending] = useActionState(createEventAction, null);
  return (
    <form action={action} className="card" style={{ display: "grid", gap: 18 }}>
      <label className="field">
        Event title
        <input className="input" name="title" placeholder="e.g. End-of-term dinner" required maxLength={100} />
      </label>
      <fieldset className="field-group">
        <legend>How long will it be?</legend>
        <label className="field">Hours<input className="input" type="number" name="durHours" min={0} max={24} defaultValue={2} /></label>
        <label className="field">Minutes<input className="input" type="number" name="durMinutes" min={0} max={59} defaultValue={0} /></label>
      </fieldset>
      <fieldset className="field-group">
        <legend>Date window (up to 14 days)</legend>
        <label className="field">First date<input className="input" type="date" name="dateStart" defaultValue={today} min={today} required /></label>
        <label className="field">Last date<input className="input" type="date" name="dateEnd" defaultValue={weekAhead} min={today} required /></label>
      </fieldset>
      <fieldset className="field-group">
        <legend>Times of day guests can pick from</legend>
        <label className="field">Earliest start<input className="input" type="time" name="dayStart" defaultValue="09:00" required /></label>
        <label className="field">Latest end<input className="input" type="time" name="dayEnd" defaultValue="22:00" required /></label>
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
