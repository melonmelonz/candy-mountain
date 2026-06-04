import { test, expect } from "bun:test";
import { dailyIndex } from "../src/game/dailypick";

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
