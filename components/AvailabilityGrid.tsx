"use client";
import { useEffect, useRef } from "react";
import { fmtDate, fmtHour } from "@/lib/format";
import {
  type Avail,
  type Status,
  setAllDay,
  setSlot,
  slotStarts,
  slotStatus,
} from "@/lib/schedule";

const next = (s: Status): Status => (s === "busy" ? "free" : s === "free" ? "maybe" : "busy");
const LABEL: Record<Status, string> = { free: "Free", maybe: "Maybe", busy: "Busy" };

export default function AvailabilityGrid({
  dates,
  dayStartMin,
  dayEndMin,
  value,
  onChange,
}: {
  dates: string[];
  dayStartMin: number;
  dayEndMin: number;
  value: Avail;
  onChange: (v: Avail) => void;
}) {
  const slots = slotStarts(dayStartMin, dayEndMin);
  const painting = useRef<Status | null>(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const stop = () => (painting.current = null);
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  const paint = (date: string, min: number, status: Status) => {
    if (slotStatus(latest.current, date, min) === status) return;
    const v = setSlot(latest.current, date, min, status, dayStartMin, dayEndMin);
    latest.current = v;
    onChange(v);
  };

  return (
    <div className="grid-wrap">
      <div className="legend" aria-hidden="true">
        <span><i className="swatch s-free" /> Free</span>
        <span><i className="swatch s-maybe" /> Maybe</span>
        <span><i className="swatch s-busy" /> Busy</span>
        <span className="muted small">Click or drag to paint. Click again to cycle Free → Maybe → Busy.</span>
      </div>
      <div className="avail-scroll">
        <table className="avail">
          <thead>
            <tr>
              <th />
              {dates.map((d) => {
                const day = value[d];
                const whole = day?.all;
                return (
                  <th key={d}>
                    <div className="day-head">{fmtDate(d)}</div>
                    <button
                      type="button"
                      className={`whole s-${whole ?? "busy"}`}
                      onClick={() => onChange(setAllDay(value, d, next(whole ?? "busy")))}
                      aria-label={`Whole day ${fmtDate(d)}: ${LABEL[whole ?? "busy"]}. Click to change.`}
                    >
                      {whole ? `All day: ${LABEL[whole]}` : "Whole day"}
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {slots.map((m) => (
              <tr key={m}>
                <th scope="row" className="time-label">{m % 60 === 0 ? fmtHour(m) : ""}</th>
                {dates.map((d) => {
                  const s = slotStatus(value, d, m);
                  return (
                    <td key={d}>
                      <button
                        type="button"
                        className={`cell s-${s} ${m % 60 === 0 ? "hour" : ""}`}
                        aria-label={`${fmtDate(d)} ${fmtHour(m)}${m % 60 ? ":30" : ""}: ${LABEL[s]}`}
                        onPointerDown={(e) => {
                          (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                          const n = next(slotStatus(latest.current, d, m));
                          painting.current = n;
                          paint(d, m, n);
                        }}
                        onPointerEnter={() => painting.current && paint(d, m, painting.current)}
                        onKeyDown={(e) => {
                          if (e.key === " " || e.key === "Enter") {
                            e.preventDefault();
                            paint(d, m, next(slotStatus(latest.current, d, m)));
                          }
                        }}
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
