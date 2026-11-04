import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getUser, type User } from "./store";

const COOKIE = "ketchup_session";
const GUEST_COOKIE = "ketchup_guest";
const YEAR = 60 * 60 * 24 * 365;

const secret = () => process.env.SESSION_SECRET ?? "dev-only-secret-change-me";
const sign = (v: string) => crypto.createHmac("sha256", secret()).update(v).digest("base64url");

export function signSession(userId: number): string {
  const v = String(userId);
  return `${v}.${sign(v)}`;
}

export function verifySession(token: string | undefined): number | null {
  if (!token) return null;
  const [v, sig] = token.split(".");
  if (!v || !sig) return null;
  const expected = sign(v);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const id = Number(v);
  return Number.isInteger(id) ? id : null;
}

export const sessionCookie = (userId: number) => ({
  name: COOKIE,
  value: signSession(userId),
  options: { httpOnly: true, sameSite: "lax" as const, path: "/", maxAge: YEAR, secure: process.env.NODE_ENV === "production" },
});

export async function currentUser(): Promise<User | null> {
  const id = verifySession((await cookies()).get(COOKIE)?.value);
  return id ? getUser(id) : null;
}

/** Identify the viewer for per-event responses: signed-in user, else an anonymous browser token. */
export async function viewer(opts: { create?: boolean } = {}) {
  const jar = await cookies();
  const user = await currentUser();
  let guest = jar.get(GUEST_COOKIE)?.value ?? null;
  if (!user && !guest && opts.create) {
    guest = crypto.randomBytes(12).toString("base64url");
    jar.set(GUEST_COOKIE, guest, { httpOnly: true, sameSite: "lax", path: "/", maxAge: YEAR });
  }
  const ownerKey = user ? `u:${user.id}` : guest ? `g:${guest}` : null;
  return { user, ownerKey };
}

export const safeNext = (n: string | null | undefined, fallback = "/home") =>
  n && n.startsWith("/") && !n.startsWith("//") ? n : fallback;
