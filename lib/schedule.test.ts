import { describe, expect, it } from "vitest";
import {
  type Avail,
  type EventConfig,
  type Participant,
  type Status,
  evaluate,
  isValidStart,
  rankOptions,
  sanitizeAvail,
  segments,
} from "./schedule";

const H = 60;
const D1 = "2026-03-06";
const D2 = "2026-03-07";
const cfg = (over: Partial<EventConfig> = {}): EventConfig => ({
  dateStart: D1,
  dateEnd: "2026-03-08",
  dayStartMin: 9 * H,
  dayEndMin: 22 * H,
  durationMin: 3 * H,
  ...over,
});
const win = { dayStartMin: 9 * H, dayEndMin: 22 * H };

/** Availability with free-form ranges, in minutes: rng(D1, [18*H, 21*H, "free"], ...) */
const rng = (date: string, ...rs: [number, number, Status?][]): Avail => ({
  [date]: { ranges: rs.map(([start, end, status]) => ({ start, end, status: status ?? "free" })) },
});
const person = (id: string, avail: Avail): Participant => ({ id, name: id, avail });

describe("segments", () => {
  it("merges touching ranges and lets free win over maybe", () => {
    const segs = segments(
      { ranges: [{ start: 600, end: 660, status: "free" }, { start: 660, end: 720, status: "free" }, { start: 700, end: 780, status: "maybe" }] },
      win,
    );
    expect(segs).toEqual([
      { start: 600, end: 720, status: "free" },
      { start: 720, end: 780, status: "maybe" },
    ]);
  });
  it("whole day covers the host's daily window", () => {
    expect(segments({ all: "maybe" }, win)).toEqual([{ start: 9 * H, end: 22 * H, status: "maybe" }]);
  });
});

describe("evaluate", () => {
  it("unmarked time is busy", () => {
    expect(evaluate({}, D1, 600, 720, win)).toBe("no");
  });
  it("needs the whole interval covered, with no gaps", () => {
    const a = rng(D1, [18 * H, 19 * H], [19 * H + 30, 21 * H]);
    expect(evaluate(a, D1, 18 * H, 19 * H, win)).toBe("free");
    expect(evaluate(a, D1, 18 * H, 20 * H, win)).toBe("no"); // gap 19:00-19:30
    expect(evaluate(a, D1, 19 * H + 30, 21 * H, win)).toBe("free");
  });
  it("adjacent free + maybe ranges give maybe", () => {
    const a = rng(D1, [18 * H, 19 * H, "free"], [19 * H, 21 * H, "maybe"]);
    expect(evaluate(a, D1, 18 * H, 21 * H, win)).toBe("maybe");
    expect(evaluate(a, D1, 18 * H, 19 * H, win)).toBe("free");
  });
  it("works to the minute", () => {
    const a = rng(D1, [18 * H + 7, 19 * H + 52]);
    expect(evaluate(a, D1, 18 * H + 7, 19 * H + 52, win)).toBe("free");
    expect(evaluate(a, D1, 18 * H + 6, 19 * H + 52, win)).toBe("no");
  });
});

describe("rankOptions", () => {
  it("respects duration: a 1-hour overlap can't host a 3-hour event", () => {
    const a = person("a", rng(D1, [18 * H, 19 * H]));
    const b = person("b", rng(D1, [18 * H, 21 * H]));
    const three = rankOptions(cfg({ durationMin: 3 * H }), [a, b]);
    expect(three).toHaveLength(1);
    expect(three[0].free.map((p) => p.id)).toEqual(["b"]);
    expect(three[0].no.map((p) => p.id)).toEqual(["a"]);

    const one = rankOptions(cfg({ durationMin: 1 * H }), [a, b]);
    expect(one[0].start).toBe(18 * H);
    expect(one[0].attendance).toBe(2);
  });

  it("supports any duration, not just round hours", () => {
    const a = person("a", rng(D1, [18 * H, 19 * H + 10]));
    expect(rankOptions(cfg({ durationMin: 70 }), [a])[0].start).toBe(18 * H);
    expect(rankOptions(cfg({ durationMin: 71 }), [a])).toEqual([]);
    const r = rankOptions(cfg({ durationMin: 25 }), [a])[0];
    expect([r.start, r.latestStart]).toEqual([18 * H, 19 * H + 10 - 25]);
  });

  it("finds exact overlap edges that aren't on the grid", () => {
    const a = person("a", rng(D1, [18 * H + 7, 21 * H + 3]));
    const b = person("b", rng(D1, [17 * H + 41, 20 * H + 38]));
    const [best] = rankOptions(cfg({ durationMin: 2 * H }), [a, b]);
    // overlap is 18:07-20:38 => the only 2h start for both is 18:07..18:38
    expect(best.attendance).toBe(2);
    expect(best.start).toBe(18 * H + 7);
    expect(best.latestStart).toBe(18 * H + 38);
  });

  it("ranks by maximum attendance, not all-or-nothing", () => {
    const ps = [
      person("a", rng(D1, [18 * H, 21 * H])),
      person("b", rng(D1, [18 * H, 21 * H])),
      person("c", rng(D2, [12 * H, 15 * H])),
    ];
    const ranked = rankOptions(cfg(), ps);
    expect(ranked[0].date).toBe(D1);
    expect(ranked[0].attendance).toBe(2);
    expect(ranked[0].no.map((p) => p.id)).toEqual(["c"]);
    expect(ranked.at(-1)?.date).toBe(D2); // the lone-attendee option still shows up
  });

  it("counts maybe as attending but ranks more-free options first on ties", () => {
    const ps = [
      person("a", rng(D1, [18 * H, 21 * H])),
      person("b", rng(D1, [18 * H, 21 * H, "maybe"])),
      person("c", rng(D2, [18 * H, 21 * H])),
      person("d", rng(D2, [18 * H, 21 * H])),
    ];
    const [first, second] = rankOptions(cfg(), ps);
    expect(first.date).toBe(D2);
    expect(second.date).toBe(D1);
    expect(second.maybe.map((p) => p.id)).toEqual(["b"]);
  });

  it("never schedules past the end of the day", () => {
    const ps = [person("a", { [D1]: { all: "free" } })];
    const ranked = rankOptions(cfg({ dayEndMin: 12 * H, durationMin: 2 * H }), ps);
    for (const o of ranked) expect(o.latestStart + 2 * H).toBeLessThanOrEqual(12 * H);
    expect(ranked[0].start).toBe(9 * H);
    expect(ranked[0].latestStart).toBe(10 * H);
  });

  it("collapses consecutive starts with identical attendees", () => {
    const ps = [person("a", rng(D1, [18 * H, 22 * H]))];
    const ranked = rankOptions(cfg({ durationMin: 2 * H }), ps);
    expect(ranked).toHaveLength(1);
    expect([ranked[0].start, ranked[0].latestStart]).toEqual([18 * H, 20 * H]);
  });

  it("supports whole-day availability", () => {
    const ps = [person("a", { [D2]: { all: "free" } }), person("b", { [D2]: { all: "free" } })];
    const [best] = rankOptions(cfg(), ps);
    expect(best.attendance).toBe(2);
    expect([best.date, best.start]).toEqual([D2, 9 * H]);
  });

  it("returns nothing when nobody is available or the event is longer than the day", () => {
    expect(rankOptions(cfg(), [person("a", {})])).toEqual([]);
    expect(rankOptions(cfg({ durationMin: 14 * H }), [person("a", { [D1]: { all: "free" } })])).toEqual([]);
  });

  it("handles a daily window that doesn't start or end on the hour", () => {
    const c = cfg({ dayStartMin: 9 * H + 20, dayEndMin: 11 * H + 40, durationMin: 60 });
    const [o] = rankOptions(c, [person("a", { [D1]: { all: "free" } })]);
    expect([o.start, o.latestStart]).toEqual([9 * H + 20, 10 * H + 40]);
  });
});

describe("isValidStart", () => {
  it("accepts any minute inside the window and rejects the rest", () => {
    const c = cfg();
    expect(isValidStart(c, D1, 18 * H + 17)).toBe(true);
    expect(isValidStart(c, D1, 19 * H + 1)).toBe(false); // would end after 22:00
    expect(isValidStart(c, D1, 8 * H)).toBe(false);
    expect(isValidStart(c, "2026-03-09", 10 * H)).toBe(false);
    expect(isValidStart(c, D1, 600.5)).toBe(false);
  });
});

describe("sanitizeAvail", () => {
  it("drops unknown dates and bad ranges, and clamps to the daily window", () => {
    const out = sanitizeAvail(
      {
        [D1]: {
          all: "maybe",
          ranges: [
            { start: 8 * H, end: 10 * H, status: "free" }, // clamped to 9:00
            { start: 700, end: 600, status: "free" }, // inverted
            { start: 600.5, end: 700, status: "free" }, // not integer
            { start: 600, end: 700, status: "busy" }, // bad status
            { start: 23 * H, end: 24 * H, status: "free" }, // outside window
          ],
        },
        "2030-01-01": { all: "free" },
      },
      cfg(),
    );
    expect(out).toEqual({ [D1]: { all: "maybe", ranges: [{ start: 9 * H, end: 10 * H, status: "free" }] } });
  });
  it("handles garbage and legacy shapes", () => {
    expect(sanitizeAvail(null, cfg())).toEqual({});
    expect(sanitizeAvail("x", cfg())).toEqual({});
    expect(sanitizeAvail({ [D1]: { slots: { "600": "free" } } }, cfg())).toEqual({});
  });
});
