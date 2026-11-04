import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { currentUser } from "@/lib/session";

export default async function Landing() {
  if (await currentUser()) redirect("/home");
  return (
    <>
      <Header />
      <main className="container" style={{ display: "grid", gap: 24, paddingTop: 72 }}>
        <h1 style={{ fontSize: 48, maxWidth: 600 }}>Plan the hangout, not the group chat.</h1>
        <p className="muted" style={{ fontSize: 18, maxWidth: 540, margin: 0 }}>
          Share one link, collect everyone&apos;s availability and preferences, and lock in a
          time that works for the most people.
        </p>
        <div>
          <Link href="/login" className="btn btn-primary">Get started</Link>
        </div>
      </main>
    </>
  );
}
