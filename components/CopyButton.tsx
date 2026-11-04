"use client";
import { useState } from "react";

export default function CopyButton({ path, label = "Copy link" }: { path: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <button
      type="button"
      className="btn"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(new URL(path, window.location.origin).toString());
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          window.prompt("Copy this link:", new URL(path, window.location.origin).toString());
        }
      }}
    >
      {done ? "Copied!" : label}
    </button>
  );
}
