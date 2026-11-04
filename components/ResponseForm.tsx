"use client";
import { useState, useTransition } from "react";
import { saveResponseAction } from "@/app/actions";
import { type Avail, dateRange } from "@/lib/schedule";
import AvailabilityEditor, { availError } from "./AvailabilityEditor";

type Initial = { name: string; avail: Avail } | null;

export default function ResponseForm({
  code, dateStart, dateEnd, dayStartMin, dayEndMin, durationMin, initial, defaultName,
}: {
  code: string; dateStart: string; dateEnd: string; dayStartMin: number; dayEndMin: number; durationMin: number;
  initial: Initial; defaultName: string;
}) {
  const [name, setName] = useState(initial?.name ?? defaultName);
  const [avail, setAvail] = useState<Avail>(initial?.avail ?? {});
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>({});
  const [pending, start] = useTransition();

  return (
    <form
      className="card"
      style={{ display: "grid", gap: 20 }}
      onSubmit={(e) => {
        e.preventDefault();
        const bad = availError(avail);
        if (bad) return setMsg({ error: bad });
        start(async () => {
          const r = await saveResponseAction({ code, name, avail });
          setMsg(r.error ? { error: r.error } : { ok: true });
        });
      }}
    >
      <h2 style={{ fontSize: 22 }}>{initial ? "Update your response" : "Your response"}</h2>
      <label className="field">
        Your name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} required maxLength={60} />
      </label>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>When are you free?</strong>
        <AvailabilityEditor
          dates={dateRange(dateStart, dateEnd)}
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          durationMin={durationMin}
          value={avail}
          onChange={setAvail}
        />
      </div>

      {msg.error && <p className="error" role="alert">{msg.error}</p>}
      {msg.ok && <p className="success" role="status">Saved! You can come back and edit this until the host confirms.</p>}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : initial || msg.ok ? "Update response" : "Submit response"}</button></div>
    </form>
  );
}
