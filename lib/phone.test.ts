import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone, parsePhones } from "./phone";

describe("normalizePhone", () => {
  it("treats differently-typed US numbers as the same", () => {
    for (const s of ["519-555-1234", "(519) 555 1234", "5195551234", "1 519 555 1234", "+1 (519) 555-1234"])
      expect(normalizePhone(s)).toBe("+15195551234");
  });
  it("accepts international numbers only with a leading +", () => {
    expect(normalizePhone("+44 20 7946 0958")).toBe("+442079460958");
    expect(normalizePhone("44 20 7946 0958")).toBeNull();
  });
  it("rejects junk", () => {
    for (const s of ["", "abc", "12345", "555-1234"]) expect(normalizePhone(s)).toBeNull();
  });
});

describe("parsePhones / formatPhone", () => {
  it("splits on commas/newlines, dedupes, and drops invalid entries", () => {
    expect(parsePhones("519-555-1234, (519) 555 1234\nnope; 416 555 0000")).toEqual(["+15195551234", "+14165550000"]);
  });
  it("formats North American numbers", () => {
    expect(formatPhone("+15195551234")).toBe("(519) 555-1234");
    expect(formatPhone("+442079460958")).toBe("+442079460958");
  });
});
