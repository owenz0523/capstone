import Link from "next/link";
import { redirect } from "next/navigation";
import EventList, { type EventSummary } from "@/components/EventList";
import Header from "@/components/Header";
import { fmtDate, fmtDuration, fmtRange } from "@/lib/format";
import { currentUser } from "@/lib/session";
import { listHosted, listInvited, listResponses, type EventRow } from "@/lib/store";

function summarize(e: EventRow, viewerId: number): EventSummary {
  const confirmed = e.status === "confirmed" && e.finalDate && e.finalStartMin != null;
  return {
    code: e.code,
    title: e.title,
    hostName: e.hostName,
    isHost: e.hostId === viewerId,
    status: e.status,
    when: confirmed
      ? `${fmtDate(e.finalDate!)} · ${fmtRange(e.finalStartMin!, e.finalStartMin! + e.durationMin)}`
      : e.dateStart === e.dateEnd
        ? fmtDate(e.dateStart)
        : `${fmtDate(e.dateStart)} – ${fmtDate(e.dateEnd)}`,
    duration: fmtDuration(e.durationMin),
    responses: listResponses(e.id).filter((r) => r.hasAvailability).length,
  };
}

export default async function Home() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/home");
  const hosted = listHosted(user.id).map((e) => summarize(e, user.id));
  const invited = listInvited(user).map((e) => summarize(e, user.id));

  return (
    <>
      <Header />
      <main className="container" style={{ display: "grid", gap: 36 }}>
        <div className="row">
          <div>
            <h1 style={{ fontSize: 34 }}>Hi, {user.name}</h1>
            <p className="muted" style={{ margin: "4px 0 0" }}>Here&apos;s what&apos;s happening with your events.</p>
          </div>
          <Link href="/new" className="btn btn-primary">+ Create event</Link>
        </div>
        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 22 }}>Events you created</h2>
          <EventList events={hosted} empty="You haven't created any events yet." />
        </section>
        <section style={{ display: "grid", gap: 12 }}>
          <h2 style={{ fontSize: 22 }}>You&apos;re invited to</h2>
          <EventList events={invited} empty="No invitations yet. Open an invite link to respond to an event." />
        </section>
      </main>
    </>
  );
}
