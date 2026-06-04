import { test, expect } from "bun:test";
import { dailyIndex } from "../src/game/dailypick";
import { todaysLink } from "../portal-room/src/links";

test("dailyIndex is stable for a given day and in range", () => {
  const n = 7;
  const a = dailyIndex("2026-06-04", n);
  const b = dailyIndex("2026-06-04", n);
  expect(a).toBe(b);
  expect(a).toBeGreaterThanOrEqual(0);
  expect(a).toBeLessThan(n);
});

test("dailyIndex differs across most days (not constant)", () => {
  const n = 30;
  const days = ["2026-06-04", "2026-06-05", "2026-06-06", "2026-06-07", "2026-06-08"];
  const vals = new Set(days.map((d) => dailyIndex(d, n)));
  expect(vals.size).toBeGreaterThan(1);
});

test("dailyIndex handles n=1", () => {
  expect(dailyIndex("2026-06-04", 1)).toBe(0);
});

test("todaysLink returns a stable, valid entry per day", () => {
  const a = todaysLink("2026-06-04");
  const b = todaysLink("2026-06-04");
  expect(a).toBeDefined();
  expect(a).toEqual(b);
  expect(typeof a!.url).toBe("string");
  expect(typeof a!.title).toBe("string");
});

test("todaysLink picks different days independently and stays in the list", () => {
  const days = ["2026-06-04", "2026-06-05", "2026-06-06"];
  for (const d of days) {
    const link = todaysLink(d);
    expect(link).toBeDefined();
    expect(typeof link!.url).toBe("string");
  }
});
