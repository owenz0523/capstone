import Link from "next/link";
import { redirect } from "next/navigation";
import Header from "@/components/Header";
import { currentUser, safeNext } from "@/lib/session";

const ERRORS: Record<string, string> = {
  bad: "Incorrect phone number or password.",
  exists: "An account with that phone number already exists. Try logging in.",
  missing: "Fill in every field with a valid phone number.",
};

export default async function Login({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string; mode?: string }>;
}) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  if (await currentUser()) redirect(next);
  const signup = sp.mode === "signup";
  const other = `/login?${signup ? "" : "mode=signup&"}next=${encodeURIComponent(next)}`;

  return (
    <>
      <Header />
      <main className="container" style={{ maxWidth: 440 }}>
        <form
          className="card"
          style={{ display: "grid", gap: 16 }}
          action={signup ? "/api/auth/signup" : "/api/auth/login"}
          method="post"
        >
          <h1 style={{ fontSize: 28 }}>{signup ? "Create your account" : "Welcome back"}</h1>
          {sp.error && <p className="error" role="alert">{ERRORS[sp.error] ?? "Something went wrong."}</p>}
          <input type="hidden" name="next" value={next} />
          {signup && (
            <label className="field">Name<input className="input" name="name" required autoComplete="name" /></label>
          )}
          <label className="field">
            Phone number
            <input className="input" name="phone" type="tel" required autoComplete="tel" placeholder="(519) 555-1234" />
          </label>
          <label className="field">
            Password
            <input className="input" name="password" type="password" required autoComplete={signup ? "new-password" : "current-password"} />
          </label>
          <button className="btn btn-primary" type="submit">{signup ? "Sign up" : "Log in"}</button>
          <p className="muted" style={{ margin: 0, textAlign: "center" }}>
            {signup ? "Already have an account? " : "New here? "}
            <Link href={other}>{signup ? "Log in" : "Sign up"}</Link>
          </p>
        </form>
      </main>
    </>
  );
}
