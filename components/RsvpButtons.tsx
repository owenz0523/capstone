"use client";
import { useState, useTransition } from "react";
import { rsvpAction } from "@/app/actions";

export default function RsvpButtons({ code, current, needsName }: {
  code: string; current: "going" | "not_going" | null; needsName: boolean;
}) {
  const [name, setName] = useState("");
  const [err, setErr] = useState("");
  const [pending, run] = useTransition();
  const send = (rsvp: "going" | "not_going") =>
    run(async () => {
      const r = await rsvpAction({ code, rsvp, name });
      setErr("error" in r && r.error ? r.error : "");
    });
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {needsName && (
        <label className="field">Your name<input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} /></label>
      )}
      <div className="chips">
        <button className={`chip ${current === "going" ? "on" : ""}`} disabled={pending} onClick={() => send("going")}>
          {current === "going" ? "✓ " : ""}Going
        </button>
        <button className={`chip ${current === "not_going" ? "on" : ""}`} disabled={pending} onClick={() => send("not_going")}>
          {current === "not_going" ? "✓ " : ""}Not going
        </button>
      </div>
      {err && <p className="error" role="alert">{err}</p>}
    </div>
  );
}
