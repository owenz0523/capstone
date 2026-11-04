"use client";
import Link from "next/link";
import { useRef, useState } from "react";
import CopyButton from "./CopyButton";

export type EventSummary = {
  code: string;
  title: string;
  hostName: string;
  isHost: boolean;
  status: "open" | "confirmed";
  when: string; // confirmed time or the date window
  duration: string;
  responses: number;
};

export default function EventList({ events, empty }: { events: EventSummary[]; empty: string }) {
  const [open, setOpen] = useState<EventSummary | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  if (!events.length) return <p className="muted">{empty}</p>;

  return (
    <>
      <div className="grid">
        {events.map((e) => (
          <button
            key={e.code}
            className="card event-card"
            onClick={() => {
              setOpen(e);
              dialog.current?.showModal();
            }}
          >
            <span className="row">
              <strong className="event-title">{e.title}</strong>
              <span className={`badge ${e.status === "confirmed" ? "badge-free" : ""}`}>
                {e.status === "confirmed" ? "Confirmed" : "Collecting responses"}
              </span>
            </span>
            <span className="muted">{e.when}</span>
          </button>
        ))}
      </div>

      <dialog
        ref={dialog}
        className="modal"
        onClick={(ev) => ev.target === dialog.current && dialog.current?.close()}
      >
        {open && (
          <div style={{ display: "grid", gap: 14 }}>
            <h2 style={{ fontSize: 24 }}>{open.title}</h2>
            <dl className="details">
              <dt>Status</dt>
              <dd>{open.status === "confirmed" ? "Confirmed" : "Collecting responses"}</dd>
              <dt>{open.status === "confirmed" ? "When" : "Date window"}</dt>
              <dd>{open.when}</dd>
              <dt>Duration</dt>
              <dd>{open.duration}</dd>
              <dt>Host</dt>
              <dd>{open.isHost ? "You" : open.hostName}</dd>
              <dt>Responses</dt>
              <dd>{open.responses}</dd>
            </dl>
            <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <Link className="btn btn-primary" href={`/e/${open.code}`}>Open event</Link>
              {open.isHost && <CopyButton path={`/e/${open.code}`} label="Copy invite link" />}
              <button className="btn" onClick={() => dialog.current?.close()}>Close</button>
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
