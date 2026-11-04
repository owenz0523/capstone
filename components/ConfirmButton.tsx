"use client";
import { useState, useTransition } from "react";
import { confirmAction } from "@/app/actions";

export default function ConfirmButton({ code, date, start, label }: { code: string; date: string; start: number; label: string }) {
  const [pending, run] = useTransition();
  const [err, setErr] = useState("");
  return (
    <>
      <button
        className="btn btn-primary"
        disabled={pending}
        onClick={() => {
          if (!window.confirm(`Confirm "${label}" as the final time?`)) return;
          run(async () => {
            const r = await confirmAction({ code, date, start });
            if ("error" in r && r.error) setErr(r.error);
          });
        }}
      >
        {pending ? "Confirming…" : "Confirm this time"}
      </button>
      {err && <span className="error">{err}</span>}
    </>
  );
}
