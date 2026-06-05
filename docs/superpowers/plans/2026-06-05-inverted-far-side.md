# Inverted Far Side Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Invert a drifter's movement controls (both axes) while it stands on the far (right) side of the arena seam, with two diegetic hints so the twist is discoverable.

**Architecture:** Movement is client-side prediction in `stepSelf` (`src/game/world.ts`); the server only clamps reported positions, so the whole feature is client-only. The inversion is a two-line negation in `stepSelf`. Hint #2 is a one-time whisper fired from the `main.ts` frame loop via the existing whisper channel. Hint #3 is a per-drifter photo-negative overlay in the renderer, keyed to each drifter's x.

**Tech Stack:** TypeScript, Bun (test runner: `bun:test`), Canvas 2D, Vite.

**Spec:** `docs/superpowers/specs/2026-06-05-inverted-far-side-design.md`

**Reference constant:** `ROOM_CONFIG.seamX === 640`, `ROOM_CONFIG.arenaWidth === 1280` (`src/game/config.ts`). The seam test is strict: inversion applies only when `world.self.x > ROOM_CONFIG.seamX`. `createWorld()` starts the self drifter at `arenaWidth / 2 === 640`, which is exactly the seam and therefore NOT inverted.

---

### Task 1: Control inversion in `stepSelf`

**Files:**
- Modify: `src/game/world.ts:65-77` (the `stepSelf` function)
- Test: `test/world.test.ts` (add cases to the existing `describe("stepSelf", ...)`, and fix one existing case)

- [ ] **Step 1: Add failing tests for far-side inversion**

In `test/world.test.ts`, inside the existing `describe("stepSelf", () => { ... })` block (after the "moving up sets facing=up" test, before the "diagonal" test is fine — placement does not matter), add:

```ts
  it("on the far side of the seam, pressing right moves -x and faces left", () => {
    const world = createWorld();
    world.self.x = ROOM_CONFIG.seamX + 100; // far side
    const startX = world.self.x;
    stepSelf(world, { up: false, down: false, left: false, right: true }, 0.1);
    expect(world.self.x).toBeCloseTo(startX - SPEED * 0.1, 5);
    expect(world.self.facing).toBe("left");
  });

  it("on the far side of the seam, pressing down moves -y and faces up", () => {
    const world = createWorld();
    world.self.x = ROOM_CONFIG.seamX + 100; // far side
    const startY = world.self.y;
    stepSelf(world, { up: false, down: true, left: false, right: false }, 0.1);
    expect(world.self.y).toBeCloseTo(startY - SPEED * 0.1, 5);
    expect(world.self.facing).toBe("up");
  });

  it("controls are normal exactly at the seam (x === seamX is not inverted)", () => {
    const world = createWorld();
    world.self.x = ROOM_CONFIG.seamX; // exactly on the seam -> normal
    const startX = world.self.x;
    stepSelf(world, { up: false, down: false, left: false, right: true }, 0.1);
    expect(world.self.x).toBeCloseTo(startX + SPEED * 0.1, 5);
    expect(world.self.facing).toBe("right");
  });
```

- [ ] **Step 2: Run the new tests to verify they fail**

Run: `bun test test/world.test.ts`
Expected: the two far-side tests FAIL (right input still increases x, facing is "right"). The "exactly at the seam" test PASSES already (640 is not `> 640`).

- [ ] **Step 3: Implement the inversion in `stepSelf`**

Replace the body of `stepSelf` in `src/game/world.ts` (lines 65-77) with:

```ts
export function stepSelf(world: ClientWorld, input: { up: boolean; down: boolean; left: boolean; right: boolean }, dt: number) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
  // The far side of the seam is an inverted realm: both control axes flip while
  // the drifter stands there. Facing is derived from dx/dy *after* the flip, so
  // the drifter visibly walks opposite the player's input — the diegetic tell
  // that you have crossed over. The check uses the strict ">" so a drifter
  // exactly on the seam keeps normal controls.
  if (world.self.x > ROOM_CONFIG.seamX) { dx = -dx; dy = -dy; }
  world.self.moving = dx !== 0 || dy !== 0;
  if (world.self.moving) {
    const len = Math.hypot(dx, dy) || 1;
    dx /= len; dy /= len;
    world.self.x = Math.max(0, Math.min(ROOM_CONFIG.arenaWidth, world.self.x + dx * SPEED * dt));
    world.self.y = Math.max(0, Math.min(ROOM_CONFIG.arenaHeight, world.self.y + dy * SPEED * dt));
    if (Math.abs(dx) > Math.abs(dy)) world.self.facing = dx > 0 ? "right" : "left";
    else world.self.facing = dy > 0 ? "down" : "up";
  }
}
```

(`ROOM_CONFIG` is already imported at the top of `world.ts` — no new import.)

- [ ] **Step 4: Fix the pre-existing clamp test that now collides with inversion**

The existing test `clamps to arena bounds when moving right past arenaWidth` starts the drifter at `ROOM_CONFIG.arenaWidth - 1` (1279), which is on the far side. With inversion, right-input now moves toward 0, so the test's expectation is wrong. Move the drifter to the near side so it still validates right-edge clamping under normal controls.

In `test/world.test.ts`, change this line inside that test:

```ts
    world.self.x = ROOM_CONFIG.arenaWidth - 1;
```

to:

```ts
    world.self.x = 100; // near side: normal controls, so right input clamps to arenaWidth
```

(The test uses a large `dt` of 10, so from x=100 the drifter still overshoots and clamps to `arenaWidth`. The inversion check reads the position at entry — 100, which is on the near side — so controls are normal for that call.)

- [ ] **Step 5: Run the full test file to verify everything passes**

Run: `bun test test/world.test.ts`
Expected: PASS (all `stepSelf` cases, including the two new far-side ones and the fixed clamp test).

- [ ] **Step 6: Run the whole suite and the type check**

Run: `bun test`
Expected: PASS, 0 failures.

Run: `bunx tsc --noEmit`
Expected: no output (clean).

- [ ] **Step 7: Commit**

```bash
git add src/game/world.ts test/world.test.ts
git commit -m "feat: invert controls on the far side of the seam"
```

---

### Task 2: First-crossing whisper hint

**Files:**
- Modify: `src/main.ts` (add an import, two module-scope state vars, and a frame-loop check)

This is canvas/RAF glue with no pure unit surface, so it is verified by the type check, the unchanged test suite, and a manual check rather than a new unit test.

- [ ] **Step 1: Import `ROOM_CONFIG` in `main.ts`**

`main.ts` does not currently import it. Add this import alongside the other `./game/...` imports near the top of `src/main.ts` (e.g. directly under the `import { loadAssets } from "./game/assets";` line):

```ts
import { ROOM_CONFIG } from "./game/config";
```

- [ ] **Step 2: Add module-scope crossing state**

In `src/main.ts`, next to the existing whisper state declarations:

```ts
let whisper: { text: string; start: number } | null = null;
let lastBand: "none" | "low" | "mid" | "high" = "none";
```

add two more lines immediately after them:

```ts
// First-crossing hint: fire a single whisper the first time the self drifter
// steps from the near half into the inverted far half. Plain session state.
let wasFarSide = false;
let crossedOnce = false;
```

- [ ] **Step 3: Fire the whisper on the near->far transition in the frame loop**

In the `frame(now)` function in `src/main.ts`, the existing band-whisper block reads:

```ts
    // whisper on threshold crossings; only when climbing into a higher band
    const band = bandFor(world.charge);
    if (band !== lastBand && band !== "none") {
      const order = { none: 0, low: 1, mid: 2, high: 3 };
      if (order[band] > order[lastBand]) whisper = { text: pick(WHISPERS[band]), start: now };
    }
    lastBand = band;
```

Immediately AFTER `lastBand = band;` (so a crossing wins if it coincides with a band change), add:

```ts
    // first-crossing hint for the inverted far side
    const farSide = world.self.x > ROOM_CONFIG.seamX;
    if (farSide && !wasFarSide && !crossedOnce) {
      crossedOnce = true;
      whisper = { text: "past the seam, the world turns against you", start: now };
    }
    wasFarSide = farSide;
```

The whisper rides the existing fade envelope (the block that calls `drawWhisper` later in the same frame), so no rendering change is needed.

- [ ] **Step 4: Type check and test suite**

Run: `bunx tsc --noEmit`
Expected: no output (clean).

Run: `bun test`
Expected: PASS, 0 failures (this task changes no tested unit; the suite must stay green).

- [ ] **Step 5: Manual verification**

Run: `bun run dev`, open the page, walk the drifter across the seam (the faint vertical line at screen center). Confirm the whisper "past the seam, the world turns against you" appears once on the first crossing and does not reappear on subsequent crossings. (A player who spawns already on the far side sees it on their first far-side frame — this is the intended behavior per the spec.)

- [ ] **Step 6: Commit**

```bash
git add src/main.ts
git commit -m "feat: whisper hint on first crossing into the inverted far side"
```

---

### Task 3: Negative shimmer on far-side drifters

**Files:**
- Modify: `src/game/sprite.ts` (add a `drawNegativeShimmer` helper)
- Modify: `src/game/render.ts` (call it for any drifter whose x is past the seam)

This is a visual effect with no pure unit surface; it is verified by the type check, the unchanged test suite, and a visual check in the preview harness.

- [ ] **Step 1: Add the `drawNegativeShimmer` helper to `sprite.ts`**

Append to `src/game/sprite.ts` (after `drawDrifter`). It builds a photo-negative of the current cell on a reused scratch canvas — inverting RGB via a `"difference"` fill with white, then restoring the sprite's alpha via `"destination-in"` — and blends it over whatever was already drawn at `(px,py)` at the given `alpha`:

```ts
// Scratch canvas reused across frames to build the inverted cell once per call.
let shimmerScratch: HTMLCanvasElement | null = null;

// Photo-negative overlay of one drifter cell, blended at `alpha` over whatever
// is already drawn at (px,py). Marks drifters standing in the inverted far half.
// RGB is inverted ("difference" against white) while the sprite's alpha mask is
// preserved ("destination-in"), so transparent cells stay transparent.
export function drawNegativeShimmer(
  ctx: CanvasRenderingContext2D,
  sheet: CanvasImageSource,
  facing: Facing,
  moving: boolean,
  px: number,
  py: number,
  scale: number,
  tMs: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  if (!shimmerScratch) {
    shimmerScratch = document.createElement("canvas");
    shimmerScratch.width = CELL;
    shimmerScratch.height = CELL;
  }
  const c = shimmerScratch.getContext("2d")!;
  const sxCell = frameCol(moving, tMs) * CELL;
  const syCell = ROW[facing] * CELL;

  c.globalCompositeOperation = "source-over";
  c.clearRect(0, 0, CELL, CELL);
  c.drawImage(sheet, sxCell, syCell, CELL, CELL, 0, 0, CELL, CELL);
  c.globalCompositeOperation = "difference";
  c.fillStyle = "#ffffff";
  c.fillRect(0, 0, CELL, CELL);
  c.globalCompositeOperation = "destination-in";
  c.drawImage(sheet, sxCell, syCell, CELL, CELL, 0, 0, CELL, CELL);
  c.globalCompositeOperation = "source-over";

  const dw = CELL * scale, dh = CELL * scale;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.drawImage(shimmerScratch, px - dw / 2, py - dh / 2, dw, dh);
  ctx.restore();
}
```

`ROW` is module-private in `sprite.ts` and `frameCol`/`CELL` are already defined there — the helper uses them directly, no export changes needed.

- [ ] **Step 2: Import the helper in `render.ts`**

In `src/game/render.ts`, change the sprite import (currently line 7):

```ts
import { tintedSheet, drawDrifter } from "./sprite";
```

to:

```ts
import { tintedSheet, drawDrifter, drawNegativeShimmer } from "./sprite";
```

- [ ] **Step 3: Apply the shimmer to far-side remote drifters**

In `src/game/render.ts`, in the remote-players loop, the body is drawn here (around line 349):

```ts
    drawDrifter(ctx, sheet, r.facing, r.moving, px, py - lift, scale, tMs);
    drawFlair(ctx, r.cosmetics, px, py - lift, scale, r.facing, tMs);
```

Insert the shimmer call between those two lines, scaled by the drifter's current visibility so it fades in/out with the intro/outro:

```ts
    drawDrifter(ctx, sheet, r.facing, r.moving, px, py - lift, scale, tMs);
    if (r.x > ROOM_CONFIG.seamX) {
      drawNegativeShimmer(ctx, sheet, r.facing, r.moving, px, py - lift, scale, tMs, 0.4 * Math.min(intro, 1 - outro));
    }
    drawFlair(ctx, r.cosmetics, px, py - lift, scale, r.facing, tMs);
```

(`intro` and `outro` are already computed earlier in this loop iteration; `ROOM_CONFIG` is already imported in `render.ts`.)

- [ ] **Step 4: Apply the shimmer to the self drifter**

In `src/game/render.ts`, the self drifter is drawn here (around line 360):

```ts
  drawDrifter(ctx, selfSheet, world.self.facing, world.self.moving, spx, spy - selfLift, scale, tMs);
  drawFlair(ctx, world.selfCosmetics, spx, spy - selfLift, scale, world.self.facing, tMs);
```

Insert the shimmer call between those two lines:

```ts
  drawDrifter(ctx, selfSheet, world.self.facing, world.self.moving, spx, spy - selfLift, scale, tMs);
  if (world.self.x > ROOM_CONFIG.seamX) {
    drawNegativeShimmer(ctx, selfSheet, world.self.facing, world.self.moving, spx, spy - selfLift, scale, tMs, 0.4);
  }
  drawFlair(ctx, world.selfCosmetics, spx, spy - selfLift, scale, world.self.facing, tMs);
```

- [ ] **Step 5: Type check and test suite**

Run: `bunx tsc --noEmit`
Expected: no output (clean).

Run: `bun test`
Expected: PASS, 0 failures.

- [ ] **Step 6: Visual verification in the preview harness**

The preview harness already renders drifters across positions. Build/serve the preview (`bun run dev`, open `/preview.html`) or use `node scripts/shoot.mjs http://localhost:5173/preview.html /tmp/shimmer.png` and inspect: any drifter standing past the seam (x > 640 in arena coords) carries a subtle photo-negative tint; near-side drifters are unaffected. If the effect reads as visual noise rather than a subtle tell, lower the `0.4` alpha (e.g. to `0.28`); per the spec this hint may be dropped entirely without affecting the core mechanic or the whisper.

- [ ] **Step 7: Commit**

```bash
git add src/game/sprite.ts src/game/render.ts
git commit -m "feat: negative shimmer on drifters in the inverted far side"
```

---

## Final verification

- [ ] Run `bun test` — expect all green, 0 failures.
- [ ] Run `bunx tsc --noEmit` — expect clean.
- [ ] Manual: walk across the seam — controls invert past it, the first-crossing whisper fires once, and far-side drifters carry the negative shimmer. Walk back — controls normalize and the shimmer clears.
