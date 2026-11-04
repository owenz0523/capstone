"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parsePhones } from "@/lib/phone";
import { currentUser, viewer } from "@/lib/session";
import { dateRange, isValidStart, sanitizeAvail, SLOT_MIN } from "@/lib/schedule";
import {
  addInvites,
  confirmEvent,
  createEvent,
  getEventByCode,
  saveResponse,
  saveRsvp,
} from "@/lib/store";
import { PREF_ACTIVITIES, PREF_BUDGETS, PREF_DIET } from "@/lib/format";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_DAYS = 14;

export type FormState = { error?: string } | null;

export async function createEventAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect("/login?next=/new");

  const title = String(fd.get("title") ?? "").trim();
  const durationMin = Number(fd.get("duration"));
  const dateStart = String(fd.get("dateStart") ?? "");
  const dateEnd = String(fd.get("dateEnd") ?? "");
  const dayStartMin = Number(fd.get("dayStartHour")) * 60;
  const dayEndMin = Number(fd.get("dayEndHour")) * 60;

  if (!title) return { error: "Give your event a title." };
  if (title.length > 100) return { error: "Title is too long (100 characters max)." };
  if (!DATE_RE.test(dateStart) || !DATE_RE.test(dateEnd)) return { error: "Pick a date window." };
  const days = dateRange(dateStart, dateEnd).length;
  if (days < 1) return { error: "The last date must be on or after the first date." };
  if (days > MAX_DAYS) return { error: `Date window can be at most ${MAX_DAYS} days.` };
  if (!(dayStartMin >= 0 && dayEndMin <= 24 * 60 && dayStartMin < dayEndMin))
    return { error: "Earliest time must be before latest time." };
  if (!Number.isInteger(durationMin) || durationMin < SLOT_MIN || durationMin % SLOT_MIN)
    return { error: "Pick a duration." };
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
  activities: string[];
  budget: string;
  diet: string[];
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
    activities: (input.activities ?? []).filter((a) => PREF_ACTIVITIES.includes(a)),
    budget: PREF_BUDGETS.includes(input.budget) ? input.budget : "",
    diet: (input.diet ?? []).filter((d) => PREF_DIET.includes(d)),
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
