import { NextRequest, NextResponse } from "next/server";
import { normalizePhone } from "@/lib/phone";
import { safeNext, sessionCookie } from "@/lib/session";
import { createUser } from "@/lib/store";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const form = await req.formData();
  const name = String(form.get("name") ?? "").trim();
  const phone = normalizePhone(String(form.get("phone") ?? ""));
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? ""));
  const back = (error: string) =>
    NextResponse.redirect(new URL(`/login?mode=signup&error=${error}&next=${encodeURIComponent(next)}`, url), 303);

  if (!name || !phone || !password) return back("missing");
  const user = createUser(name, phone, password);
  if (!user) return back("exists");

  const res = NextResponse.redirect(new URL(next, url), 303);
  const c = sessionCookie(user.id);
  res.cookies.set(c.name, c.value, c.options);
  return res;
}
