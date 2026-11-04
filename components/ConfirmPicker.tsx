"use client";
import { useState } from "react";
import { fmtTime } from "@/lib/format";
import ConfirmButton from "./ConfirmButton";

/** Lets the host choose an exact start within a collapsed run of equivalent starts, then confirm. */
export default function ConfirmPicker({ code, date, start, latestStart, dateLabel }: {
  code: string; date: string; start: number; latestStart: number; dateLabel: string;
}) {
  const [chosen, setChosen] = useState(start);
  const starts: number[] = [];
  for (let m = start; m <= latestStart; m += 30) starts.push(m);
  return (
    <span className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
      {starts.length > 1 && (
        <label className="small">
          Start at{" "}
          <select className="input" style={{ width: "auto", minHeight: 36 }} value={chosen} onChange={(e) => setChosen(Number(e.target.value))}>
            {starts.map((m) => <option key={m} value={m}>{fmtTime(m)}</option>)}
          </select>
        </label>
      )}
      <ConfirmButton code={code} date={date} start={chosen} label={`${dateLabel} at ${fmtTime(chosen)}`} />
    </span>
  );
}
