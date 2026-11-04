"use client";
import { useState, useTransition } from "react";
import { saveResponseAction } from "@/app/actions";
import { PREF_ACTIVITIES, PREF_BUDGETS, PREF_DIET } from "@/lib/format";
import { type Avail, dateRange } from "@/lib/schedule";
import AvailabilityGrid from "./AvailabilityGrid";

type Initial = { name: string; avail: Avail; activities: string[]; budget: string; diet: string[] } | null;

function Chips({ options, selected, onToggle, single }: {
  options: string[]; selected: string[]; onToggle: (o: string) => void; single?: boolean;
}) {
  return (
    <div className="chips" role="group">
      {options.map((o) => (
        <button
          type="button"
          key={o}
          className={`chip ${selected.includes(o) ? "on" : ""}`}
          aria-pressed={selected.includes(o)}
          onClick={() => onToggle(o)}
          data-single={single}
        >
          {selected.includes(o) ? "✓ " : ""}{o}
        </button>
      ))}
    </div>
  );
}

const toggle = (list: string[], o: string) => (list.includes(o) ? list.filter((x) => x !== o) : [...list, o]);

export default function ResponseForm({
  code, dateStart, dateEnd, dayStartMin, dayEndMin, initial, defaultName,
}: {
  code: string; dateStart: string; dateEnd: string; dayStartMin: number; dayEndMin: number;
  initial: Initial; defaultName: string;
}) {
  const [name, setName] = useState(initial?.name ?? defaultName);
  const [avail, setAvail] = useState<Avail>(initial?.avail ?? {});
  const [activities, setActivities] = useState<string[]>(initial?.activities ?? []);
  const [budget, setBudget] = useState(initial?.budget ?? "");
  const [diet, setDiet] = useState<string[]>(initial?.diet ?? []);
  const [msg, setMsg] = useState<{ error?: string; ok?: boolean }>({});
  const [pending, start] = useTransition();

  return (
    <form
      className="card"
      style={{ display: "grid", gap: 20 }}
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveResponseAction({ code, name, avail, activities, budget, diet });
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
        <AvailabilityGrid
          dates={dateRange(dateStart, dateEnd)}
          dayStartMin={dayStartMin}
          dayEndMin={dayEndMin}
          value={avail}
          onChange={setAvail}
        />
      </div>

      <div style={{ display: "grid", gap: 8 }}>
        <strong>What sounds fun? <span className="muted">(optional)</span></strong>
        <Chips options={PREF_ACTIVITIES} selected={activities} onToggle={(o) => setActivities(toggle(activities, o))} />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <strong>Budget per person <span className="muted">(optional)</span></strong>
        <Chips options={PREF_BUDGETS} selected={[budget]} onToggle={(o) => setBudget(budget === o ? "" : o)} single />
      </div>
      <div style={{ display: "grid", gap: 8 }}>
        <strong>Dietary restrictions <span className="muted">(optional, only the host sees these)</span></strong>
        <Chips options={PREF_DIET} selected={diet} onToggle={(o) => setDiet(toggle(diet, o))} />
      </div>

      {msg.error && <p className="error" role="alert">{msg.error}</p>}
      {msg.ok && <p className="success" role="status">Saved! You can come back and edit this until the host confirms.</p>}
      <div><button className="btn btn-primary" disabled={pending}>{pending ? "Saving…" : initial || msg.ok ? "Update response" : "Submit response"}</button></div>
    </form>
  );
}
