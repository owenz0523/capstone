import { describe, expect, it } from "vitest";
import {
  type EventConfig,
  type Participant,
  evaluate,
  isValidStart,
  rankOptions,
  sanitizeAvail,
  setAllDay,
  setSlot,
  slotStatus,
} from "./schedule";

const H = 60;
const cfg = (over: Partial<EventConfig> = {}): EventConfig => ({
  dateStart: "2026-03-06",
  dateEnd: "2026-03-08",
  dayStartMin: 9 * H,
  dayEndMin: 22 * H,
  durationMin: 3 * H,
  ...over,
});

/** Mark [fromH, toH) free on a date with specific slots. */
function slots(date: string, fromH: number, toH: number, status: "free" | "maybe" = "free") {
  const s: Record<string, "free" | "maybe"> = {};
  for (let m = fromH * H; m < toH * H; m += 30) s[String(m)] = status;
  return { [date]: { slots: s } };
}
const person = (id: string, avail: Participant["avail"]): Participant => ({ id, name: id, avail });

describe("slotStatus / evaluate", () => {
  it("treats unmarked time as busy", () => {
    expect(slotStatus({}, "2026-03-06", 600)).toBe("busy");
  });
  it("whole-day free covers every slot", () => {
    const a = { "2026-03-06": { all: "free" as const } };
    expect(evaluate(a, "2026-03-06", 9 * H, 3 * H)).toBe("free");
  });
  it("specific slots override a whole-day mark", () => {
    const a = { "2026-03-06": { all: "free" as const, slots: { "600": "busy" as const } } };
    expect(evaluate(a, "2026-03-06", 9 * H, 3 * H)).toBe("no");
    expect(evaluate(a, "2026-03-06", 11 * H, 2 * H)).toBe("free");
  });
  it("one maybe slot makes the whole window maybe; one busy slot rules it out", () => {
    const a = slots("2026-03-06", 18, 21);
    a["2026-03-06"].slots["1170"] = "maybe";
    expect(evaluate(a, "2026-03-06", 18 * H, 3 * H)).toBe("maybe");
    expect(evaluate(a, "2026-03-06", 18 * H, 4 * H)).toBe("no");
  });
});

describe("rankOptions", () => {
  it("respects duration: a 1-hour overlap can't host a 3-hour event", () => {
    const a = person("a", slots("2026-03-06", 18, 19));
    const b = person("b", slots("2026-03-06", 18, 21));
    const three = rankOptions(cfg({ durationMin: 3 * H }), [a, b]);
    expect(three).toHaveLength(1);
    expect(three[0].free.map((p) => p.id)).toEqual(["b"]);
    expect(three[0].no.map((p) => p.id)).toEqual(["a"]);

    const one = rankOptions(cfg({ durationMin: 1 * H }), [a, b]);
    expect(one[0].start).toBe(18 * H);
    expect(one[0].attendance).toBe(2);
  });

  it("ranks by maximum attendance, not all-or-nothing", () => {
    const ps = [
      person("a", slots("2026-03-06", 18, 21)),
      person("b", slots("2026-03-06", 18, 21)),
      person("c", slots("2026-03-07", 12, 15)),
    ];
    const ranked = rankOptions(cfg(), ps);
    expect(ranked[0].date).toBe("2026-03-06");
    expect(ranked[0].attendance).toBe(2);
    expect(ranked[0].no.map((p) => p.id)).toEqual(["c"]);
    // the lone-attendee option still shows up, just lower
    expect(ranked.at(-1)?.date).toBe("2026-03-07");
  });

  it("counts maybe as attending but ranks more-free options first on ties", () => {
    const ps = [
      person("a", slots("2026-03-06", 18, 21)),
      person("b", slots("2026-03-06", 18, 21, "maybe")),
      person("c", slots("2026-03-07", 18, 21)),
      person("d", slots("2026-03-07", 18, 21)),
    ];
    const [first, second] = rankOptions(cfg(), ps);
    expect(first.date).toBe("2026-03-07");
    expect(first.attendance).toBe(2);
    expect(second.date).toBe("2026-03-06");
    expect(second.maybe.map((p) => p.id)).toEqual(["b"]);
  });

  it("never schedules past the end of the day or spans days", () => {
    const ps = [person("a", { "2026-03-06": { all: "free" } })];
    const ranked = rankOptions(cfg({ dayEndMin: 12 * H, durationMin: 2 * H }), ps);
    for (const o of ranked) expect(o.end).toBeLessThanOrEqual(12 * H);
    expect(ranked[0].start).toBe(9 * H);
    expect(ranked[0].latestStart).toBe(10 * H);
  });

  it("collapses adjacent starts with identical attendees into one option", () => {
    const ps = [person("a", slots("2026-03-06", 18, 22))];
    const ranked = rankOptions(cfg({ durationMin: 2 * H }), ps);
    expect(ranked).toHaveLength(1);
    expect(ranked[0].start).toBe(18 * H);
    expect(ranked[0].latestStart).toBe(20 * H);
  });

  it("supports whole-day availability", () => {
    const ps = [
      person("a", { "2026-03-07": { all: "free" } }),
      person("b", { "2026-03-07": { all: "free" } }),
    ];
    const ranked = rankOptions(cfg(), ps);
    expect(ranked[0].attendance).toBe(2);
    expect(ranked[0].date).toBe("2026-03-07");
    expect(ranked[0].start).toBe(9 * H);
  });

  it("returns nothing when nobody is available or duration exceeds the day", () => {
    expect(rankOptions(cfg(), [person("a", {})])).toEqual([]);
    const all = person("a", { "2026-03-06": { all: "free" } });
    expect(rankOptions(cfg({ durationMin: 14 * H }), [all])).toEqual([]);
  });
});

describe("isValidStart", () => {
  it("accepts in-window starts and rejects others", () => {
    const c = cfg();
    expect(isValidStart(c, "2026-03-06", 18 * H)).toBe(true);
    expect(isValidStart(c, "2026-03-06", 20 * H)).toBe(false); // would end after 22:00
    expect(isValidStart(c, "2026-03-09", 10 * H)).toBe(false); // outside date window
    expect(isValidStart(c, "2026-03-06", 10 * H + 10)).toBe(false); // off-grid
  });
});

describe("sanitizeAvail", () => {
  it("drops unknown dates, bad slots and bad statuses", () => {
    const out = sanitizeAvail(
      {
        "2026-03-06": { all: "free", slots: { "600": "maybe", "601": "free", "30": "free", "660": "nope" } },
        "2030-01-01": { all: "free" },
        "2026-03-07": { all: "busy" },
      },
      cfg(),
    );
    expect(out).toEqual({ "2026-03-06": { all: "free", slots: { "600": "maybe" } } });
  });
  it("handles garbage", () => {
    expect(sanitizeAvail(null, cfg())).toEqual({});
    expect(sanitizeAvail("x", cfg())).toEqual({});
  });
});

describe("setSlot / setAllDay", () => {
  it("expands a whole-day mark before editing a single slot", () => {
    const a = setAllDay({}, "2026-03-06", "free");
    const b = setSlot(a, "2026-03-06", 12 * H, "busy", 9 * H, 22 * H);
    expect(slotStatus(b, "2026-03-06", 12 * H)).toBe("busy");
    expect(slotStatus(b, "2026-03-06", 13 * H)).toBe("free");
    expect(b["2026-03-06"].all).toBeUndefined();
  });
  it("removes the day when its last slot is cleared", () => {
    const a = setSlot({}, "2026-03-06", 600, "free", 9 * H, 22 * H);
    expect(setSlot(a, "2026-03-06", 600, "busy", 9 * H, 22 * H)).toEqual({});
  });
  it("clears a whole day", () => {
    expect(setAllDay({ "2026-03-06": { all: "maybe" } }, "2026-03-06", "busy")).toEqual({});
  });
});
