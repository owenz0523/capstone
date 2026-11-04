"use client";
import { useState } from "react";
import { fmtTime, fromTimeInput, toTimeInput } from "@/lib/format";
import ConfirmButton from "./ConfirmButton";

/** Lets the host fine-tune the exact start within a run of equally-good starts, then confirm. */
export default function ConfirmPicker({ code, date, start, latestStart, dateLabel }: {
  code: string; date: string; start: number; latestStart: number; dateLabel: string;
}) {
  const [text, setText] = useState(toTimeInput(start));
  const parsed = fromTimeInput(text);
  const valid = parsed != null && parsed >= start && parsed <= latestStart;
  return (
    <span className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap", gap: 8 }}>
      {latestStart > start && (
        <label className="small">
          Start at{" "}
          <input
            className="input" type="time" style={{ width: "auto", minHeight: 40 }}
            value={text} min={toTimeInput(start)} max={toTimeInput(latestStart)}
            onChange={(e) => setText(e.target.value)}
          />
        </label>
      )}
      {valid ? (
        <ConfirmButton code={code} date={date} start={parsed} label={`${dateLabel} at ${fmtTime(parsed)}`} />
      ) : (
        <span className="error small">Pick a start between {fmtTime(start)} and {fmtTime(latestStart)}</span>
      )}
    </span>
  );
}
