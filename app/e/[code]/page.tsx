import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";
import ConfirmPicker from "@/components/ConfirmPicker";
import CopyButton from "@/components/CopyButton";
import Header from "@/components/Header";
import ResponseForm from "@/components/ResponseForm";
import RsvpButtons from "@/components/RsvpButtons";
import { addInvitesAction } from "@/app/actions";
import { formatPhone } from "@/lib/phone";
import { fmtDate, fmtDuration, fmtRange } from "@/lib/format";
import { rankOptions } from "@/lib/schedule";
import { viewer } from "@/lib/session";
import { getEventByCode, listInvitePhones, listResponses } from "@/lib/store";

function tally(lists: string[][]) {
  const m = new Map<string, number>();
  for (const l of lists) for (const x of l) m.set(x, (m.get(x) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export default async function EventPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const event = getEventByCode(code);
  if (!event) notFound();

  const { user, ownerKey } = await viewer();
  const isHost = user?.id === event.hostId;
  const responses = listResponses(event.id);
  const mine = ownerKey ? responses.find((r) => r.ownerKey === ownerKey) ?? null : null;
  const confirmed = event.status === "confirmed" && event.finalDate && event.finalStartMin != null;
  const withAvail = responses.filter((r) => r.hasAvailability);
  const path = `/e/${event.code}`;
  const h = await headers();
  const origin = `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;

  const options = isHost && !confirmed
    ? rankOptions(
        event,
        withAvail.map((r) => ({ id: String(r.id), name: r.name, avail: r.avail })),
      ).slice(0, 6)
    : [];

  return (
    <>
      <Header />
      <main className="container" style={{ display: "grid", gap: 24, maxWidth: 860 }}>
        {user && (
          <Link href="/home" className="btn back-link">← Back to dashboard</Link>
        )}
        <div style={{ display: "grid", gap: 6 }}>
          <span className={`badge ${confirmed ? "badge-free" : ""}`} style={{ justifySelf: "start" }}>
            {confirmed ? "Confirmed" : "Collecting responses"}
          </span>
          <h1 style={{ fontSize: 38 }}>{event.title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Hosted by {isHost ? "you" : event.hostName} · {fmtDuration(event.durationMin)}
            {!confirmed && <> · {fmtDate(event.dateStart)}{event.dateStart !== event.dateEnd && ` – ${fmtDate(event.dateEnd)}`}</>}
          </p>
        </div>

        {confirmed && (
          <section className="card confirmed">
            <h2 style={{ fontSize: 22 }}>It&apos;s happening</h2>
            <p style={{ fontSize: 22, margin: "6px 0 0", fontWeight: 600 }}>
              {fmtDate(event.finalDate!, true)}
            </p>
            <p style={{ fontSize: 18, margin: 0 }}>{fmtRange(event.finalStartMin!, event.finalStartMin! + event.durationMin)}</p>
          </section>
        )}

        {confirmed && (
          <section className="card" style={{ display: "grid", gap: 12 }}>
            <h2 style={{ fontSize: 22 }}>Are you going?</h2>
            <RsvpButtons code={code} current={mine?.rsvp ?? null} needsName={!user && !mine} />
          </section>
        )}

        {confirmed && isHost && (() => {
          const going = responses.filter((r) => r.rsvp === "going");
          const notGoing = responses.filter((r) => r.rsvp === "not_going");
          const noReply = responses.filter((r) => !r.rsvp);
          const seen = new Set(responses.map((r) => r.phone).filter(Boolean));
          const pendingInvites = listInvitePhones(event.id).filter((e) => !seen.has(e));
          return (
            <section className="card" style={{ display: "grid", gap: 12 }}>
              <h2 style={{ fontSize: 22 }}>RSVP summary</h2>
              <div className="stats">
                <div><strong>{going.length}</strong><span className="muted">Going</span></div>
                <div><strong>{notGoing.length}</strong><span className="muted">Not going</span></div>
                <div><strong>{noReply.length + pendingInvites.length}</strong><span className="muted">No response</span></div>
              </div>
              <dl className="details">
                <dt>Going</dt><dd>{going.map((r) => r.name).join(", ") || "—"}</dd>
                <dt>Not going</dt><dd>{notGoing.map((r) => r.name).join(", ") || "—"}</dd>
                <dt>No response</dt>
                <dd>{[...noReply.map((r) => r.name), ...pendingInvites.map(formatPhone)].join(", ") || "—"}</dd>
              </dl>
            </section>
          );
        })()}

        {!confirmed && (
          <ResponseForm
            code={code}
            dateStart={event.dateStart}
            dateEnd={event.dateEnd}
            dayStartMin={event.dayStartMin}
            dayEndMin={event.dayEndMin}
            defaultName={user?.name ?? ""}
            initial={mine?.hasAvailability ? { name: mine.name, avail: mine.avail, activities: mine.activities, budget: mine.budget, diet: mine.diet } : null}
          />
        )}
        {!confirmed && !user && (
          <p className="muted small">
            Have an account? <Link href={`/login?next=${encodeURIComponent(path)}`}>Sign in</Link> to keep this event on your home screen.
          </p>
        )}

        {isHost && (
          <>
            <section className="card" style={{ display: "grid", gap: 12 }}>
              <h2 style={{ fontSize: 22 }}>Invite people</h2>
              <div className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
                <code className="link-box">{origin + path}</code>
                <CopyButton path={path} label="Copy invite link" />
              </div>
              <p className="muted small" style={{ margin: 0 }}>Anyone with the link can respond — no account needed.</p>
              <form action={addInvitesAction} className="row" style={{ justifyContent: "flex-start", flexWrap: "wrap", alignItems: "stretch" }}>
                <input type="hidden" name="code" value={code} />
                <input className="input" name="phones" placeholder="Add people by phone number" type="tel" style={{ flex: "1 1 260px", width: "auto" }} />
                <button className="btn">Add</button>
              </form>
              {listInvitePhones(event.id).length > 0 && (
                <p className="small muted" style={{ margin: 0 }}>Invited: {listInvitePhones(event.id).map(formatPhone).join(", ")}</p>
              )}
            </section>

            {!confirmed && (
              <section className="card" style={{ display: "grid", gap: 14 }}>
                <h2 style={{ fontSize: 22 }}>Best times</h2>
                <p className="muted small" style={{ margin: 0 }}>
                  {withAvail.length} {withAvail.length === 1 ? "person has" : "people have"} responded. Ranked by how many can make it
                  for the full {fmtDuration(event.durationMin)}.
                </p>
                {options.length === 0 ? (
                  <p className="muted">
                    {withAvail.length === 0
                      ? "Nothing yet — share the link and times will show up here."
                      : `No time fits a ${fmtDuration(event.durationMin)} event for anyone yet.`}
                  </p>
                ) : (
                  options.map((o) => (
                    <div key={`${o.date}-${o.start}`} className="option">
                      <div className="row" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
                        <div>
                          <strong>{fmtDate(o.date)} · {fmtRange(o.start, o.end)}</strong>
                          {o.latestStart > o.start && (
                            <div className="muted small">Same group works for any start up to {fmtRange(o.latestStart, o.latestStart + event.durationMin).split(" – ")[0]}</div>
                          )}
                        </div>
                        <span className="badge badge-free">{o.attendance}/{withAvail.length} can attend</span>
                      </div>
                      <div className="small" style={{ display: "grid", gap: 2 }}>
                        <span><b className="t-free">Free:</b> {o.free.map((p) => p.name).join(", ") || "—"}</span>
                        {o.maybe.length > 0 && <span><b className="t-maybe">Maybe:</b> {o.maybe.map((p) => p.name).join(", ")}</span>}
                        {o.no.length > 0 && <span className="muted"><b>Can&apos;t:</b> {o.no.map((p) => p.name).join(", ")}</span>}
                      </div>
                      <ConfirmPicker code={code} date={o.date} start={o.start} latestStart={o.latestStart} dateLabel={fmtDate(o.date)} />
                    </div>
                  ))
                )}
              </section>
            )}

            <section className="card" style={{ display: "grid", gap: 12 }}>
              <h2 style={{ fontSize: 22 }}>Preferences</h2>
              {withAvail.length === 0 ? (
                <p className="muted">No responses yet.</p>
              ) : (
                <dl className="details">
                  <dt>Activities</dt>
                  <dd>{tally(withAvail.map((r) => r.activities)).map(([k, n]) => `${k} (${n})`).join(", ") || "—"}</dd>
                  <dt>Budget</dt>
                  <dd>{tally(withAvail.map((r) => (r.budget ? [r.budget] : []))).map(([k, n]) => `${k} (${n})`).join(", ") || "—"}</dd>
                  <dt>Dietary</dt>
                  <dd>
                    {withAvail.some((r) => r.diet.length)
                      ? tally(withAvail.map((r) => r.diet)).map(([k, n]) => `${k} (${n}: ${withAvail.filter((r) => r.diet.includes(k)).map((r) => r.name).join(", ")})`).join("; ")
                      : "—"}
                  </dd>
                </dl>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
