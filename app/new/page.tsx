import { redirect } from "next/navigation";
import Header from "@/components/Header";
import NewEventForm from "@/components/NewEventForm";
import { currentUser } from "@/lib/session";

const iso = (d: Date) => d.toISOString().slice(0, 10);

export default async function NewEvent() {
  if (!(await currentUser())) redirect("/login?next=/new");
  const now = new Date();
  const week = new Date(now.getTime() + 6 * 864e5);
  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 640, display: "grid", gap: 20 }}>
        <h1 style={{ fontSize: 34 }}>Create an event</h1>
        <NewEventForm today={iso(now)} weekAhead={iso(week)} />
      </main>
    </>
  );
}
