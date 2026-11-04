"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePhones } from "@/lib/phone";
import { currentUser, viewer } from "@/lib/session";
import { dateRange, isValidStart, sanitizeAvail } from "@/lib/schedule";
import {
  addInvites,
  confirmEvent,
  createEvent,
  getEventByCode,
  saveResponse,
  saveRsvp,
} from "@/lib/store";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 14;

/** "HH:MM" -> minutes from midnight, or null. */
function parseTime(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  const v = Number(m[1]) * 60 + Number(m[2]);
  return Number(m[2]) < 60 && v <= 24 * 60 ? v : null;
}

export type FormState = { error?: string } | null;

export async function createEventAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/login?next=/new");

  const title = String(fd.get("title") ?? "").trim();
  const durationMin = Number(fd.get("durHours") || 0) * 60 + Number(fd.get("durMinutes") || 0);
  const dateStart = String(fd.get("dateStart") ?? "");
  const dateEnd = String(fd.get("dateEnd") ?? "");
  const dayStartMin = parseTime(String(fd.get("dayStart") ?? ""));
  const dayEndMin = parseTime(String(fd.get("dayEnd") ?? ""));

  if (!title) return { error: "Give your event a title." };
  if (title.length > 100) return { error: "Title is too long (100 characters max)." };
  if (!DATE_RE.test(dateStart) || !DATE_RE.test(dateEnd)) return { error: "Pick a date window." };
  const days = dateRange(dateStart, dateEnd).length;
  if (days < 1) return { error: "The last date must be on or after the first date." };
  if (days > MAX_DAYS) return { error: `Date window can be at most ${MAX_DAYS} days.` };
  if (dayStartMin == null || dayEndMin == null || dayStartMin >= dayEndMin)
    return { error: "Earliest start must be before latest end." };
  if (!Number.isInteger(durationMin) || durationMin < 5)
    return { error: "Enter how long the event will be (at least 5 minutes)." };
  if (durationMin > dayEndMin - dayStartMin)
    return { error: "Duration is longer than the daily time window you chose." };

  const code = createEvent({
    hostId: user.id,
    title,
    durationMin,
    dateStart,
    dateEnd,
    dayStartMin,
    dayEndMin,
    invitePhones: parsePhones(String(fd.get("phones") ?? "")),
  });
  redirect(`/e/${code}`);
}

export async function addInvitesAction(fd: FormData) {
  const user = await currentUser();
  const code = String(fd.get("code") ?? "");
  const event = getEventByCode(code);
  if (!user || !event || event.hostId !== user.id) return;
  addInvites(event.id, parsePhones(String(fd.get("phones") ?? "")));
  revalidatePath(`/e/${code}`);
}

export type ResponseInput = {
  code: string;
  name: string;
  avail: unknown;
};

export async function saveResponseAction(input: ResponseInput): Promise<{ error?: string; ok?: true }> {
  const event = getEventByCode(input.code);
  if (!event) return { error: "Event not found." };
  if (event.status === "confirmed") return { error: "This event is already confirmed." };
  const name = String(input.name ?? "").trim().slice(0, 60);
  if (!name) return { error: "Enter your name." };

  const avail = sanitizeAvail(input.avail, event);
  if (!Object.keys(avail).length) return { error: "Mark at least one time you're available." };

  const { user, ownerKey } = await viewer({ create: true });
  saveResponse({
    eventId: event.id,
    ownerKey: ownerKey!,
    userId: user?.id ?? null,
    name,
    avail,
  });
  revalidatePath(`/e/${input.code}`);
  return { ok: true };
}

export async function confirmAction(input: { code: string; date: string; start: number }) {
  const user = await currentUser();
  const event = getEventByCode(input.code);
  if (!user || !event || event.hostId !== user.id) return { error: "Only the host can confirm." };
  if (!isValidStart(event, input.date, input.start)) return { error: "That time isn't valid for this event." };
  confirmEvent(event.id, input.date, input.start);
  revalidatePath(`/e/${input.code}`);
  revalidatePath("/home");
  return { ok: true as const };
}

export async function rsvpAction(input: { code: string; rsvp: "going" | "not_going"; name?: string }) {
  const event = getEventByCode(input.code);
  if (!event || event.status !== "confirmed") return { error: "RSVPs open once the event is confirmed." };
  if (input.rsvp !== "going" && input.rsvp !== "not_going") return { error: "Invalid RSVP." };
  const { user, ownerKey } = await viewer({ create: true });
  const name = (user?.name ?? input.name ?? "").trim().slice(0, 60);
  if (!name) return { error: "Enter your name." };
  saveRsvp({ eventId: event.id, ownerKey: ownerKey!, userId: user?.id ?? null, name, rsvp: input.rsvp });
  revalidatePath(`/e/${input.code}`);
  return { ok: true as const };
}
