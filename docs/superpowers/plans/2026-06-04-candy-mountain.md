# Candy Mountain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single-page space arena where the present crowd performs a cooperative "split ritual" to open a center portal that redirects everyone to a daily-rotating curated website.

**Architecture:** Preact + Canvas SPA on Cloudflare Pages talks over WebSockets to a single global Durable Object (`PortalRoom`) living in a sibling Worker. Movement is client-authoritative and relayed; the ritual (spot coverage + charge) is server-authoritative and lives in a pure, unit-tested `roomReducer`. Zero UI, fully diegetic.

**Tech Stack:** Preact, Vite, TypeScript, Bun (dev/build/test), HTML5 Canvas, Cloudflare Pages, Cloudflare Workers + Durable Objects (hibernatable WebSockets), Wrangler, GitHub Actions, PixelLab MCP for art.

**Sprint map:**
- **Sprint 0** — Scaffold + deploy pipeline (prop it all up; verify push-to-deploy).
- **Sprint 1** — Pure ritual core (`roomReducer`), full TDD, zero runtime deps.
- **Sprint 2** — `PortalRoom` Durable Object + WebSocket protocol.
- **Sprint 3** — Client: canvas world, movement, networking (placeholder art).
- **Sprint 4** — Diegetic ritual feedback (glowing spots, portal-as-charge, open + redirect).
- **Sprint 5** — PixelLab art + character randomization.
- **Sprint 6** — Daily links, day boundary, final deploy + contributor docs.

---

## File Structure

```
candy-mountain/
  index.html                      # SPA entry
  package.json                    # bun scripts
  vite.config.ts
  tsconfig.json
  wrangler.toml                   # Pages config; binds PortalRoom via script_name
  links.json                      # curated daily destinations (partner edits via PR)
  src/
    main.ts                       # Preact bootstrap: mounts canvas, owns WS lifecycle
    net.ts                        # WebSocket client: connect, send, decode messages
    protocol.ts                   # SHARED message types (client + worker import this)
    game/
      config.ts                   # ROOM_CONFIG constants (shared with worker)
      reducer.ts                  # PURE ritual logic (shared with worker)
      types.ts                    # SHARED domain types
      render.ts                   # canvas draw loop
      world.ts                    # client-side world state + interpolation
      cosmetics.ts                # random look (hue/visor/flair) + localStorage seed
      input.ts                    # WASD/Space handling
  portal-room/
    wrangler.toml                 # declares PortalRoom + [[migrations]]
    src/
      index.ts                    # Worker entry: routes /room to the DO
      room.ts                     # PortalRoom DO: WS hibernation + tick + broadcast
  test/
    reducer.test.ts
    cosmetics.test.ts
    dailypick.test.ts
  .github/workflows/deploy.yml
  docs/superpowers/specs/2026-06-04-candy-mountain-design.md
  docs/superpowers/plans/2026-06-04-candy-mountain.md
  CONTRIBUTING.md                 # how the partner adds links
```

Note: `src/game/reducer.ts`, `src/game/config.ts`, `src/game/types.ts`, and `src/protocol.ts` are imported by BOTH the client and the worker. The worker `tsconfig`/bundler resolves them via relative path (`../src/...`).

---

## Sprint 0 — Scaffold + deploy pipeline

**Outcome:** an empty-but-real Preact page deployed to Pages, a deployed Worker with a DO that answers `/room` health checks, and a green GitHub Actions run. This is the "prop it all up" sprint.

### Task 0.1: Initialize the Pages app

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.ts`, `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "candy-mountain",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "bun test",
    "deploy:worker": "cd portal-room && bunx wrangler deploy",
    "deploy:pages": "bun run build && bunx wrangler pages deploy dist --project-name=candy-mountain --commit-dirty=true"
  },
  "dependencies": {
    "preact": "^10.22.0"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "^4.20240914.0",
    "@preact/preset-vite": "^2.10.5",
    "@types/bun": "^1.1.0",
    "typescript": "^5.5.0",
    "vite": "^5.3.0",
    "wrangler": "^3.78.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "strict": true,
    "skipLibCheck": true,
    "types": ["@cloudflare/workers-types", "@types/bun"],
    "lib": ["ES2022", "DOM", "DOM.Iterable"]
  },
  "include": ["src", "portal-room/src", "test"]
}
```

- [ ] **Step 3: Write `vite.config.ts`**

```ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: { target: "es2022" },
});
```

- [ ] **Step 4: Write `index.html`**

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no" />
    <title>Candy Mountain</title>
    <style>
      html, body { margin: 0; height: 100%; background: #060414; overflow: hidden; }
      #app, canvas { display: block; width: 100vw; height: 100vh; }
      canvas { image-rendering: pixelated; touch-action: none; }
    </style>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

- [ ] **Step 5: Write a minimal `src/main.ts`** (replaced in Sprint 3; just proves the build)

```ts
const app = document.getElementById("app")!;
const canvas = document.createElement("canvas");
app.appendChild(canvas);
const ctx = canvas.getContext("2d")!;
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();
ctx.fillStyle = "#7c5cff";
ctx.font = "16px system-ui";
ctx.fillText("candy mountain: scaffolding", 24, 40);
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
.wrangler/
.superpowers/
.dev.vars
```

- [ ] **Step 7: Install + build to verify**

Run: `bun install && bun run build`
Expected: `dist/` is produced with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add package.json tsconfig.json vite.config.ts index.html src/main.ts .gitignore
git commit -m "scaffold Preact + Vite Pages app"
```

### Task 0.2: Scaffold the sibling Worker + DO skeleton

**Files:**
- Create: `portal-room/wrangler.toml`, `portal-room/src/index.ts`, `portal-room/src/room.ts`

- [ ] **Step 1: Write `portal-room/wrangler.toml`**

```toml
name = "candy-mountain-room"
main = "src/index.ts"
compatibility_date = "2024-09-23"
compatibility_flags = ["nodejs_compat"]

[[durable_objects.bindings]]
name = "PORTAL_ROOM"
class_name = "PortalRoom"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["PortalRoom"]
```

- [ ] **Step 2: Write `portal-room/src/room.ts` (skeleton)**

```ts
export interface Env {
  PORTAL_ROOM: DurableObjectNamespace;
}

export class PortalRoom implements DurableObject {
  constructor(
    private state: DurableObjectState,
    private env: Env,
  ) {}

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") {
      return new Response("ok", { status: 200 });
    }
    return new Response("not found", { status: 404 });
  }
}
```

- [ ] **Step 3: Write `portal-room/src/index.ts`**

```ts
import { PortalRoom } from "./room";
export { PortalRoom };

export interface Env {
  PORTAL_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/room" || url.pathname === "/health") {
      const id = env.PORTAL_ROOM.idFromName("global");
      const stub = env.PORTAL_ROOM.get(id);
      return stub.fetch(req);
    }
    return new Response("candy-mountain-room", { status: 200 });
  },
};
```

- [ ] **Step 4: Verify it runs locally**

Run: `cd portal-room && bunx wrangler dev --port 8788` then in another shell `curl -s localhost:8788/health`
Expected: `ok`. Stop the dev server afterward.

- [ ] **Step 5: Commit**

```bash
git add portal-room/
git commit -m "scaffold portal-room Worker with PortalRoom DO skeleton"
```

### Task 0.3: Pages binding + deploy workflow

**Files:**
- Create: `wrangler.toml` (Pages), `links.json`, `.github/workflows/deploy.yml`

- [ ] **Step 1: Write the Pages `wrangler.toml`** (binds the DO from the sibling Worker)

```toml
name = "candy-mountain"
pages_build_output_dir = "dist"
compatibility_date = "2024-09-23"

[[durable_objects.bindings]]
name = "PORTAL_ROOM"
class_name = "PortalRoom"
script_name = "candy-mountain-room"
```

- [ ] **Step 2: Write a starter `links.json`**

```json
[
  { "url": "https://stars.chromeexperiments.com/", "title": "100,000 Stars", "blurb": "Fly through a map of nearby stars.", "addedBy": "penn" },
  { "url": "https://neal.fun/deep-sea/", "title": "The Deep Sea", "blurb": "Scroll to the bottom of the ocean.", "addedBy": "penn" },
  { "url": "https://www.windy.com/", "title": "Windy", "blurb": "Hypnotic live wind map of the whole planet.", "addedBy": "penn" }
]
```

- [ ] **Step 3: Write `.github/workflows/deploy.yml`** (Worker first, then Pages)

```yaml
name: deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v2
      - run: bun install
      - name: Deploy Worker (DO host)
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          workingDirectory: portal-room
      - name: Build SPA
        run: bun run build
      - name: Deploy Pages
        uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: pages deploy dist --project-name=candy-mountain
```

- [ ] **Step 4: Create the public GitHub repo and push**

Run:
```bash
gh repo create melonmelonz/candy-mountain --public --source=. --remote=origin --push
```
Expected: repo created, `main` pushed. (Confirm with Penn before this network action.)

- [ ] **Step 5: Add CF secrets to the repo**

Run (interactive — Penn provides token/account id):
```bash
gh secret set CLOUDFLARE_API_TOKEN
gh secret set CLOUDFLARE_ACCOUNT_ID
```
Expected: both secrets stored. The first push triggers the workflow; verify with `gh run watch`.

- [ ] **Step 6: Commit**

```bash
git add wrangler.toml links.json .github/workflows/deploy.yml
git commit -m "add Pages DO binding, starter links, and Worker-then-Pages deploy workflow"
```

---

## Sprint 1 — Pure ritual core (`roomReducer`)

**Outcome:** all ritual math implemented and unit-tested with zero runtime dependencies. This is the heart of the game and the most valuable thing to get right. TDD throughout.

### Task 1.1: Domain types and config

**Files:**
- Create: `src/game/types.ts`, `src/game/config.ts`

- [ ] **Step 1: Write `src/game/types.ts`**

```ts
export type PlayerId = string;
export type Side = "left" | "right";
export type Facing = "up" | "down" | "left" | "right";
export type Flair = "antenna" | "backpack" | "trail" | "emblem";

export interface Vec2 { x: number; y: number; }

export interface Cosmetics {
  hue: number;       // 0..360 suit color
  visorHue: number;  // 0..360 visor tint
  flair: Flair;
}

export interface Player {
  id: PlayerId;
  pos: Vec2;
  facing: Facing;
  moving: boolean;
  cosmetics: Cosmetics;
  lastInputAt: number; // ms epoch of last move/hello
}

export interface Spot {
  id: string;
  side: Side;
  pos: Vec2;
  covered: boolean;
}

export interface RoomState {
  players: Record<PlayerId, Player>;
  spots: Spot[];
  charge: number; // 0..100
  dayId: string;  // e.g. "2026-06-04"
}
```

- [ ] **Step 2: Write `src/game/config.ts`**

```ts
export interface RoomConfig {
  arenaWidth: number;
  arenaHeight: number;
  seamX: number;
  spotRadius: number;
  maxPerSide: number;
  idleMs: number;
  chargeRisePerTick: number;
  chargeDecayPerTick: number;
  minActiveToOpen: number;
}

export const ROOM_CONFIG: RoomConfig = {
  arenaWidth: 1280,
  arenaHeight: 720,
  seamX: 640,
  spotRadius: 36,
  maxPerSide: 5,
  idleMs: 30_000,
  chargeRisePerTick: 4,   // ~2.5s of full coverage at 10Hz -> 100
  chargeDecayPerTick: 6,
  minActiveToOpen: 2,
};
```

- [ ] **Step 3: Commit**

```bash
git add src/game/types.ts src/game/config.ts
git commit -m "add domain types and room config"
```

### Task 1.2: Active players + spot scaling

**Files:**
- Create: `src/game/reducer.ts`
- Test: `test/reducer.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test, expect } from "bun:test";
import { activePlayerIds, desiredSpotsPerSide } from "../src/game/reducer";
import { ROOM_CONFIG } from "../src/game/config";
import type { Player } from "../src/game/types";

function mk(id: string, lastInputAt: number): Player {
  return { id, pos: { x: 0, y: 0 }, facing: "down", moving: false,
    cosmetics: { hue: 0, visorHue: 0, flair: "antenna" }, lastInputAt };
}

test("idle players are excluded from active set", () => {
  const now = 100_000;
  const players = { a: mk("a", now), b: mk("b", now - 5_000), c: mk("c", now - 40_000) };
  const active = activePlayerIds(players, now, ROOM_CONFIG);
  expect(active.sort()).toEqual(["a", "b"]);
});

test("spots per side scale with active count and clamp", () => {
  expect(desiredSpotsPerSide(1, ROOM_CONFIG)).toBe(0); // below minimum
  expect(desiredSpotsPerSide(2, ROOM_CONFIG)).toBe(1);
  expect(desiredSpotsPerSide(7, ROOM_CONFIG)).toBe(3);
  expect(desiredSpotsPerSide(50, ROOM_CONFIG)).toBe(5); // clamped to maxPerSide
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun test test/reducer.test.ts`
Expected: FAIL — `activePlayerIds`/`desiredSpotsPerSide` not exported.

- [ ] **Step 3: Implement**

```ts
import type { Player, PlayerId, RoomState, Spot, Side } from "./types";
import type { RoomConfig } from "./config";

export function activePlayerIds(
  players: Record<PlayerId, Player>,
  now: number,
  cfg: RoomConfig,
): PlayerId[] {
  return Object.values(players)
    .filter((p) => now - p.lastInputAt <= cfg.idleMs)
    .map((p) => p.id);
}

export function desiredSpotsPerSide(activeCount: number, cfg: RoomConfig): number {
  if (activeCount < cfg.minActiveToOpen) return 0;
  return Math.min(Math.floor(activeCount / 2), cfg.maxPerSide);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun test test/reducer.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts test/reducer.test.ts
git commit -m "add active-player and spot-scaling logic with tests"
```

### Task 1.3: Spot layout (deterministic positions)

**Files:**
- Modify: `src/game/reducer.ts`
- Test: `test/reducer.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import { layoutSpots } from "../src/game/reducer";

test("layoutSpots places equal spots per side, left of/right of seam", () => {
  const spots = layoutSpots(2, ROOM_CONFIG);
  expect(spots.length).toBe(4);
  const left = spots.filter((s) => s.side === "left");
  const right = spots.filter((s) => s.side === "right");
  expect(left.length).toBe(2);
  expect(right.length).toBe(2);
  expect(left.every((s) => s.pos.x < ROOM_CONFIG.seamX)).toBe(true);
  expect(right.every((s) => s.pos.x > ROOM_CONFIG.seamX)).toBe(true);
  expect(spots.every((s) => s.covered === false)).toBe(true);
});

test("layoutSpots is deterministic", () => {
  expect(layoutSpots(3, ROOM_CONFIG)).toEqual(layoutSpots(3, ROOM_CONFIG));
});

test("layoutSpots with 0 per side is empty", () => {
  expect(layoutSpots(0, ROOM_CONFIG)).toEqual([]);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test test/reducer.test.ts`
Expected: FAIL — `layoutSpots` not exported.

- [ ] **Step 3: Implement**

```ts
export function layoutSpots(perSide: number, cfg: RoomConfig): Spot[] {
  if (perSide <= 0) return [];
  const spots: Spot[] = [];
  const marginY = cfg.arenaHeight * 0.18;
  const usableH = cfg.arenaHeight - marginY * 2;
  const leftX = cfg.seamX * 0.45;
  const rightX = cfg.seamX + (cfg.arenaWidth - cfg.seamX) * 0.55;
  for (const side of ["left", "right"] as Side[]) {
    const x = side === "left" ? leftX : rightX;
    for (let i = 0; i < perSide; i++) {
      const t = perSide === 1 ? 0.5 : i / (perSide - 1);
      const y = marginY + usableH * t;
      spots.push({ id: `${side}-${i}`, side, pos: { x, y }, covered: false });
    }
  }
  return spots;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/reducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts test/reducer.test.ts
git commit -m "add deterministic spot layout with tests"
```

### Task 1.4: Coverage detection

**Files:**
- Modify: `src/game/reducer.ts`
- Test: `test/reducer.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import { computeCoverage, allCovered } from "../src/game/reducer";

test("a spot is covered only by an ACTIVE player within radius", () => {
  const cfg = ROOM_CONFIG;
  const spots = layoutSpots(1, cfg); // one left, one right
  const leftSpot = spots.find((s) => s.side === "left")!;
  const now = 0;
  const players = {
    onspot: { ...mk("onspot", now), pos: { x: leftSpot.pos.x + 5, y: leftSpot.pos.y } },
    faraway: { ...mk("faraway", now), pos: { x: 0, y: 0 } },
    idleOnSpot: { id: "idleOnSpot", pos: { x: spots[1].pos.x, y: spots[1].pos.y },
      facing: "down" as const, moving: false,
      cosmetics: { hue: 0, visorHue: 0, flair: "antenna" as const }, lastInputAt: -cfg.idleMs - 1 },
  };
  const active = activePlayerIds(players, now, cfg);
  const covered = computeCoverage(spots, players, active, cfg);
  expect(covered.find((s) => s.side === "left")!.covered).toBe(true);
  // right spot only had an idle player on it -> not covered
  expect(covered.find((s) => s.side === "right")!.covered).toBe(false);
  expect(allCovered(covered)).toBe(false);
});

test("allCovered is false for empty spot list", () => {
  expect(allCovered([])).toBe(false);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test test/reducer.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

```ts
export function computeCoverage(
  spots: Spot[],
  players: Record<PlayerId, Player>,
  activeIds: PlayerId[],
  cfg: RoomConfig,
): Spot[] {
  const r2 = cfg.spotRadius * cfg.spotRadius;
  const activeSet = new Set(activeIds);
  return spots.map((spot) => {
    const covered = activeIds.some((id) => {
      if (!activeSet.has(id)) return false;
      const p = players[id];
      const dx = p.pos.x - spot.pos.x;
      const dy = p.pos.y - spot.pos.y;
      return dx * dx + dy * dy <= r2;
    });
    return { ...spot, covered };
  });
}

export function allCovered(spots: Spot[]): boolean {
  return spots.length > 0 && spots.every((s) => s.covered);
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/reducer.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts test/reducer.test.ts
git commit -m "add coverage detection with tests"
```

### Task 1.5: Charge stepping + the `tick` orchestrator

**Files:**
- Modify: `src/game/reducer.ts`
- Test: `test/reducer.test.ts`

- [ ] **Step 1: Add failing test**

```ts
import { stepCharge, tick } from "../src/game/reducer";

test("charge rises when all covered, decays otherwise, clamped 0..100", () => {
  const cfg = ROOM_CONFIG;
  expect(stepCharge(0, false, cfg)).toBe(0);
  expect(stepCharge(10, false, cfg)).toBe(10 - cfg.chargeDecayPerTick);
  expect(stepCharge(0, true, cfg)).toBe(cfg.chargeRisePerTick);
  expect(stepCharge(99, true, cfg)).toBe(100);
});

test("tick relayouts spots when active count changes and opens at full charge", () => {
  const cfg = { ...ROOM_CONFIG, chargeRisePerTick: 100 }; // open in one tick when covered
  // build a state with 2 active players standing on the 1-per-side spots
  const base = { players: {}, spots: [], charge: 0, dayId: "2026-06-04" } as RoomState;
  const spots = layoutSpots(1, cfg);
  const L = spots.find((s) => s.side === "left")!;
  const R = spots.find((s) => s.side === "right")!;
  const now = 1000;
  base.players = {
    l: { ...mk("l", now), pos: { ...L.pos } },
    r: { ...mk("r", now), pos: { ...R.pos } },
  };
  const out = tick(base, now, cfg);
  expect(out.state.spots.length).toBe(2);
  expect(out.opened).toBe(true);
  expect(out.state.charge).toBe(0); // reset after open
});

test("tick does not open below minimum active players", () => {
  const cfg = { ...ROOM_CONFIG, chargeRisePerTick: 100 };
  const now = 1000;
  const base: RoomState = {
    players: { solo: { ...mk("solo", now), pos: { x: 0, y: 0 } } },
    spots: [], charge: 0, dayId: "2026-06-04",
  };
  const out = tick(base, now, cfg);
  expect(out.opened).toBe(false);
  expect(out.state.spots.length).toBe(0);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test test/reducer.test.ts`
Expected: FAIL — `stepCharge`/`tick` not exported.

- [ ] **Step 3: Implement**

```ts
export function stepCharge(charge: number, covered: boolean, cfg: RoomConfig): number {
  const next = covered ? charge + cfg.chargeRisePerTick : charge - cfg.chargeDecayPerTick;
  return Math.max(0, Math.min(100, next));
}

export interface TickResult {
  state: RoomState;
  opened: boolean;
}

export function tick(state: RoomState, now: number, cfg: RoomConfig): TickResult {
  const active = activePlayerIds(state.players, now, cfg);
  const perSide = desiredSpotsPerSide(active.length, cfg);

  // Relayout only when the spot count changes (keeps positions stable otherwise).
  const currentPerSide = state.spots.filter((s) => s.side === "left").length;
  let spots = perSide === currentPerSide ? state.spots : layoutSpots(perSide, cfg);

  spots = computeCoverage(spots, state.players, active, cfg);
  const covered = allCovered(spots);
  let charge = stepCharge(state.charge, covered, cfg);

  let opened = false;
  if (charge >= 100) {
    opened = true;
    charge = 0; // reset so a future crowd can re-open
  }

  return { state: { ...state, spots, charge }, opened };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/reducer.test.ts`
Expected: PASS (all reducer tests green).

- [ ] **Step 5: Commit**

```bash
git add src/game/reducer.ts test/reducer.test.ts
git commit -m "add charge stepping and tick orchestrator with tests"
```

### Task 1.6: Deterministic daily pick

**Files:**
- Create: `src/game/dailypick.ts`
- Test: `test/dailypick.test.ts`

- [ ] **Step 1: Write failing test**

```ts
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
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test test/dailypick.test.ts`
Expected: FAIL — `dailyIndex` not exported.

- [ ] **Step 3: Implement (FNV-1a hash, salted to avoid an obvious sequence)**

```ts
export function dailyIndex(dayId: string, n: number): number {
  if (n <= 1) return 0;
  const salted = `candy-mountain::${dayId}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < salted.length; i++) {
    h ^= salted.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) % n;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/dailypick.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/dailypick.ts test/dailypick.test.ts
git commit -m "add deterministic daily destination pick with tests"
```

---

## Sprint 2 — `PortalRoom` Durable Object + protocol

**Outcome:** the DO accepts WebSocket connections, tracks players, runs the tick loop using `reducer.tick`, broadcasts state, and emits `open` with the daily destination.

### Task 2.1: Shared wire protocol

**Files:**
- Create: `src/protocol.ts`

- [ ] **Step 1: Write `src/protocol.ts`**

```ts
import type { Cosmetics, Facing, PlayerId, Spot } from "./game/types";

export interface PlayerWire {
  id: PlayerId;
  x: number; y: number;
  facing: Facing;
  moving: boolean;
  cosmetics: Cosmetics;
}

// client -> server
export type ClientMsg =
  | { t: "hello"; cosmetics: Cosmetics }
  | { t: "move"; x: number; y: number; facing: Facing; moving: boolean };

// server -> client
export type ServerMsg =
  | { t: "welcome"; id: PlayerId; spawn: { x: number; y: number }; dayId: string }
  | { t: "state"; players: PlayerWire[]; spots: Spot[]; charge: number }
  | { t: "open"; url: string; title: string };

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}
export function decode<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/protocol.ts
git commit -m "add shared client/server wire protocol"
```

### Task 2.2: Wire the DO with hibernatable WebSockets + tick loop

**Files:**
- Modify: `portal-room/src/room.ts`
- Modify: `portal-room/src/index.ts` (import links + pass through)
- Create: `portal-room/src/links.ts` (imports root `links.json`)

- [ ] **Step 1: Create `portal-room/src/links.ts`**

```ts
import links from "../../links.json";
import { dailyIndex } from "../../src/game/dailypick";

export interface Link { url: string; title: string; blurb?: string; addedBy?: string; }

export function todaysLink(dayId: string): Link {
  const list = links as Link[];
  return list[dailyIndex(dayId, list.length)];
}
```

- [ ] **Step 2: Replace `portal-room/src/room.ts` with the full DO**

```ts
import type { Env } from "./index";
import type { Player, PlayerId, RoomState, Cosmetics } from "../../src/game/types";
import { ROOM_CONFIG } from "../../src/game/config";
import { tick } from "../../src/game/reducer";
import { encode, decode, type ClientMsg, type PlayerWire, type ServerMsg } from "../../src/protocol";
import { todaysLink } from "./links";

const TICK_MS = 100; // 10 Hz
const SPAWN_MARGIN = 80;

function dayIdNow(): string {
  return new Date().toISOString().slice(0, 10); // UTC day boundary
}

export class PortalRoom implements DurableObject {
  private players: Record<PlayerId, Player> = {};
  private charge = 0;
  private spots: RoomState["spots"] = [];
  private socketFor = new Map<WebSocket, PlayerId>();
  private alarmSet = false;

  constructor(private state: DurableObjectState, private env: Env) {
    // Re-adopt sockets that survived hibernation.
    for (const ws of this.state.getWebSockets()) {
      const id = (ws.deserializeAttachment() as { id: PlayerId } | null)?.id;
      if (id) this.socketFor.set(ws, id);
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname !== "/room") return new Response("not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket")
      return new Response("expected websocket", { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server);

    const id = crypto.randomUUID();
    server.serializeAttachment({ id });
    this.socketFor.set(server, id);

    const spawn = {
      x: SPAWN_MARGIN + Math.random() * (ROOM_CONFIG.arenaWidth - SPAWN_MARGIN * 2),
      y: SPAWN_MARGIN + Math.random() * (ROOM_CONFIG.arenaHeight - SPAWN_MARGIN * 2),
    };
    const dayId = dayIdNow();
    this.players[id] = {
      id, pos: spawn, facing: "down", moving: false,
      cosmetics: { hue: 0, visorHue: 0, flair: "antenna" },
      lastInputAt: Date.now(),
    };
    server.send(encode({ t: "welcome", id, spawn, dayId } satisfies ServerMsg));
    this.ensureAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const id = this.socketFor.get(ws);
    if (!id) return;
    const p = this.players[id];
    if (!p) return;
    const msg = decode<ClientMsg>(raw);
    p.lastInputAt = Date.now();
    if (msg.t === "hello") {
      p.cosmetics = msg.cosmetics as Cosmetics;
    } else if (msg.t === "move") {
      p.pos = {
        x: Math.max(0, Math.min(ROOM_CONFIG.arenaWidth, msg.x)),
        y: Math.max(0, Math.min(ROOM_CONFIG.arenaHeight, msg.y)),
      };
      p.facing = msg.facing;
      p.moving = msg.moving;
    }
  }

  async webSocketClose(ws: WebSocket) { this.drop(ws); }
  async webSocketError(ws: WebSocket) { this.drop(ws); }

  private drop(ws: WebSocket) {
    const id = this.socketFor.get(ws);
    if (id) { delete this.players[id]; this.socketFor.delete(ws); }
  }

  private ensureAlarm() {
    if (!this.alarmSet) {
      this.alarmSet = true;
      this.state.storage.setAlarm(Date.now() + TICK_MS);
    }
  }

  async alarm() {
    this.alarmSet = false;
    const now = Date.now();
    const dayId = dayIdNow();

    const result = tick(
      { players: this.players, spots: this.spots, charge: this.charge, dayId },
      now, ROOM_CONFIG,
    );
    this.spots = result.state.spots;
    this.charge = result.state.charge;

    const playersWire: PlayerWire[] = Object.values(this.players).map((p) => ({
      id: p.id, x: p.pos.x, y: p.pos.y, facing: p.facing, moving: p.moving, cosmetics: p.cosmetics,
    }));
    this.broadcast(encode({ t: "state", players: playersWire, spots: this.spots, charge: this.charge }));

    if (result.opened) {
      const link = todaysLink(dayId);
      this.broadcast(encode({ t: "open", url: link.url, title: link.title }));
    }

    // Keep ticking only while someone is connected.
    if (this.state.getWebSockets().length > 0) this.ensureAlarm();
  }

  private broadcast(data: string) {
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(data); } catch { /* socket gone; cleaned on close */ }
    }
  }
}
```

- [ ] **Step 3: Update `portal-room/src/index.ts` to forward the Upgrade**

(No change needed beyond Sprint 0 — `/room` already proxies to the DO. Verify the file still routes `/room` to `idFromName("global")`.)

- [ ] **Step 4: Type-check + smoke test locally**

Run:
```bash
bun run build           # ensures shared imports type-check
cd portal-room && bunx wrangler dev --port 8788
```
In another shell:
```bash
bunx wscat -c ws://localhost:8788/room   # or any ws client
```
Expected: a `welcome` JSON frame, then `state` frames ~10x/sec.

- [ ] **Step 5: Commit**

```bash
git add portal-room/src/room.ts portal-room/src/links.ts portal-room/src/index.ts
git commit -m "implement PortalRoom DO: hibernatable websockets, tick loop, daily open"
```

---

## Sprint 3 — Client: canvas world, movement, networking

**Outcome:** open the page, spawn as a colored square (placeholder), walk with WASD, see other connected players move in real time. Art is still placeholder rectangles.

### Task 3.1: Cosmetics generation + persistence

**Files:**
- Create: `src/game/cosmetics.ts`
- Test: `test/cosmetics.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { test, expect } from "bun:test";
import { rollCosmetics, loadOrCreateCosmetics } from "../src/game/cosmetics";

test("rollCosmetics produces in-range values and a valid flair", () => {
  const c = rollCosmetics(() => 0.5);
  expect(c.hue).toBeGreaterThanOrEqual(0);
  expect(c.hue).toBeLessThan(360);
  expect(["antenna", "backpack", "trail", "emblem"]).toContain(c.flair);
});

test("loadOrCreateCosmetics persists the same look across calls", () => {
  const store = new Map<string, string>();
  const fakeStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
  } as Storage;
  const a = loadOrCreateCosmetics(fakeStorage, Math.random);
  const b = loadOrCreateCosmetics(fakeStorage, Math.random);
  expect(b).toEqual(a);
});
```

- [ ] **Step 2: Run to verify fail**

Run: `bun test test/cosmetics.test.ts`
Expected: FAIL — not exported.

- [ ] **Step 3: Implement**

```ts
import type { Cosmetics, Flair } from "./types";

const FLAIRS: Flair[] = ["antenna", "backpack", "trail", "emblem"];
const KEY = "cm:cosmetics:v1";

export function rollCosmetics(rng: () => number = Math.random): Cosmetics {
  return {
    hue: Math.floor(rng() * 360),
    visorHue: Math.floor(rng() * 360),
    flair: FLAIRS[Math.floor(rng() * FLAIRS.length)],
  };
}

export function loadOrCreateCosmetics(storage: Storage, rng: () => number = Math.random): Cosmetics {
  const raw = storage.getItem(KEY);
  if (raw) {
    try { return JSON.parse(raw) as Cosmetics; } catch { /* fall through */ }
  }
  const c = rollCosmetics(rng);
  storage.setItem(KEY, JSON.stringify(c));
  return c;
}
```

- [ ] **Step 4: Run to verify pass**

Run: `bun test test/cosmetics.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/game/cosmetics.ts test/cosmetics.test.ts
git commit -m "add cosmetics roll + localStorage persistence with tests"
```

### Task 3.2: Input handling

**Files:**
- Create: `src/game/input.ts`

- [ ] **Step 1: Implement keyboard input tracker**

```ts
export interface InputState { up: boolean; down: boolean; left: boolean; right: boolean; jump: boolean; }

export function createInput(target: Window = window): { state: InputState; dispose: () => void } {
  const state: InputState = { up: false, down: false, left: false, right: false, jump: false };
  const map: Record<string, keyof InputState> = {
    KeyW: "up", ArrowUp: "up", KeyS: "down", ArrowDown: "down",
    KeyA: "left", ArrowLeft: "left", KeyD: "right", ArrowRight: "right", Space: "jump",
  };
  const down = (e: KeyboardEvent) => { const k = map[e.code]; if (k) { state[k] = true; e.preventDefault(); } };
  const up = (e: KeyboardEvent) => { const k = map[e.code]; if (k) { state[k] = false; e.preventDefault(); } };
  target.addEventListener("keydown", down);
  target.addEventListener("keyup", up);
  return { state, dispose: () => { target.removeEventListener("keydown", down); target.removeEventListener("keyup", up); } };
}
```

- [ ] **Step 2: Commit**

```bash
git add src/game/input.ts
git commit -m "add WASD/arrows/space input tracker"
```

### Task 3.3: Client world state + interpolation

**Files:**
- Create: `src/game/world.ts`

- [ ] **Step 1: Implement local + remote world model**

```ts
import type { Facing, Spot } from "./types";
import type { PlayerWire } from "../protocol";
import { ROOM_CONFIG } from "./config";

export interface RemotePlayer extends PlayerWire { tx: number; ty: number; } // tx/ty = target for lerp

export interface ClientWorld {
  selfId: string | null;
  self: { x: number; y: number; facing: Facing; moving: boolean };
  remotes: Map<string, RemotePlayer>;
  spots: Spot[];
  charge: number;
}

export function createWorld(): ClientWorld {
  return {
    selfId: null,
    self: { x: ROOM_CONFIG.arenaWidth / 2, y: ROOM_CONFIG.arenaHeight / 2, facing: "down", moving: false },
    remotes: new Map(),
    spots: [],
    charge: 0,
  };
}

export function applyState(world: ClientWorld, players: PlayerWire[], spots: Spot[], charge: number) {
  world.spots = spots;
  world.charge = charge;
  const seen = new Set<string>();
  for (const p of players) {
    seen.add(p.id);
    if (p.id === world.selfId) continue; // self is locally predicted
    const existing = world.remotes.get(p.id);
    if (existing) {
      existing.tx = p.x; existing.ty = p.y; existing.facing = p.facing; existing.moving = p.moving; existing.cosmetics = p.cosmetics;
    } else {
      world.remotes.set(p.id, { ...p, tx: p.x, ty: p.y });
    }
  }
  for (const id of [...world.remotes.keys()]) if (!seen.has(id)) world.remotes.delete(id);
}

export function interpolateRemotes(world: ClientWorld, alpha = 0.25) {
  for (const r of world.remotes.values()) {
    r.x += (r.tx - r.x) * alpha;
    r.y += (r.ty - r.y) * alpha;
  }
}

const SPEED = 220; // px/sec

export function stepSelf(world: ClientWorld, input: { up: boolean; down: boolean; left: boolean; right: boolean }, dt: number) {
  let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
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

- [ ] **Step 2: Commit**

```bash
git add src/game/world.ts
git commit -m "add client world model with self-prediction and remote interpolation"
```

### Task 3.4: WebSocket client

**Files:**
- Create: `src/net.ts`

- [ ] **Step 1: Implement the net client**

```ts
import { encode, decode, type ClientMsg, type ServerMsg } from "./protocol";

export interface NetHandlers {
  onWelcome: (id: string, spawn: { x: number; y: number }, dayId: string) => void;
  onState: (msg: Extract<ServerMsg, { t: "state" }>) => void;
  onOpen: (url: string, title: string) => void;
}

export function connect(handlers: NetHandlers): { send: (m: ClientMsg) => void; close: () => void } {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/room`);
  ws.addEventListener("message", (e) => {
    const msg = decode<ServerMsg>(e.data as string);
    if (msg.t === "welcome") handlers.onWelcome(msg.id, msg.spawn, msg.dayId);
    else if (msg.t === "state") handlers.onState(msg);
    else if (msg.t === "open") handlers.onOpen(msg.url, msg.title);
  });
  const send = (m: ClientMsg) => { if (ws.readyState === WebSocket.OPEN) ws.send(encode(m)); };
  return { send, close: () => ws.close() };
}
```

- [ ] **Step 2: Add the `/room` proxy to the Pages app**

Pages binds the DO directly, but the SPA needs a same-origin `/room` route. Create `functions/room.ts` (Pages Functions):

```ts
interface Env { PORTAL_ROOM: DurableObjectNamespace; }
export const onRequest: PagesFunction<Env> = (ctx) => {
  const id = ctx.env.PORTAL_ROOM.idFromName("global");
  return ctx.env.PORTAL_ROOM.get(id).fetch(ctx.request);
};
```

- [ ] **Step 3: Commit**

```bash
git add src/net.ts functions/room.ts
git commit -m "add websocket net client and Pages /room proxy"
```

### Task 3.5: Placeholder render loop + wire it together

**Files:**
- Create: `src/game/render.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Implement a placeholder renderer (rectangles)**

```ts
import type { ClientWorld } from "./world";
import { ROOM_CONFIG } from "./config";

export function drawPlaceholder(ctx: CanvasRenderingContext2D, world: ClientWorld, vw: number, vh: number) {
  const sx = vw / ROOM_CONFIG.arenaWidth;
  const sy = vh / ROOM_CONFIG.arenaHeight;
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = "#060414";
  ctx.fillRect(0, 0, vw, vh);

  // seam
  ctx.strokeStyle = "#7c5cff";
  ctx.beginPath(); ctx.moveTo(ROOM_CONFIG.seamX * sx, 0); ctx.lineTo(ROOM_CONFIG.seamX * sx, vh); ctx.stroke();

  // portal brightness reflects charge
  const cx = ROOM_CONFIG.seamX * sx, cy = (ROOM_CONFIG.arenaHeight / 2) * sy;
  ctx.globalAlpha = 0.3 + (world.charge / 100) * 0.7;
  ctx.fillStyle = "#7c5cff";
  ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // spots
  for (const s of world.spots) {
    ctx.strokeStyle = s.side === "left" ? "#00e0ff" : "#ff8ad1";
    ctx.globalAlpha = s.covered ? 1 : 0.4;
    ctx.beginPath(); ctx.arc(s.pos.x * sx, s.pos.y * sy, ROOM_CONFIG.spotRadius * sx, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // remote players
  for (const r of world.remotes.values()) {
    ctx.fillStyle = `hsl(${r.cosmetics.hue} 80% 60%)`;
    ctx.fillRect(r.x * sx - 8, r.y * sy - 8, 16, 16);
  }
  // self
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(world.self.x * sx - 8, world.self.y * sy - 8, 16, 16);
}
```

- [ ] **Step 2: Rewrite `src/main.ts` to run the loop**

```ts
import { createWorld, applyState, interpolateRemotes, stepSelf } from "./game/world";
import { createInput } from "./game/input";
import { drawPlaceholder } from "./game/render";
import { loadOrCreateCosmetics } from "./game/cosmetics";
import { connect } from "./net";

const app = document.getElementById("app")!;
const canvas = document.createElement("canvas");
app.appendChild(canvas);
const ctx = canvas.getContext("2d")!;
let vw = 0, vh = 0;
function resize() { vw = canvas.width = innerWidth; vh = canvas.height = innerHeight; }
addEventListener("resize", resize); resize();

const world = createWorld();
const input = createInput();
const cosmetics = loadOrCreateCosmetics(localStorage);

const net = connect({
  onWelcome: (id, spawn) => { world.selfId = id; world.self.x = spawn.x; world.self.y = spawn.y; net.send({ t: "hello", cosmetics }); },
  onState: (msg) => applyState(world, msg.players, msg.spots, msg.charge),
  onOpen: (url) => { location.href = url; },
});

let last = performance.now();
let lastSent = 0;
function frame(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  stepSelf(world, input.state, dt);
  interpolateRemotes(world);
  if (now - lastSent > 66) { // ~15 Hz
    lastSent = now;
    net.send({ t: "move", x: world.self.x, y: world.self.y, facing: world.self.facing, moving: world.self.moving });
  }
  drawPlaceholder(ctx, world, vw, vh);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
```

- [ ] **Step 3: End-to-end manual test**

Run: `bun run build` then `bunx wrangler pages dev dist --port 8789` (with the worker also deployed/dev-bound), open two browser tabs.
Expected: two white/colored squares; moving in one tab moves a square in the other; standing on the two spots brightens the portal; full charge redirects both tabs.

- [ ] **Step 4: Commit**

```bash
git add src/game/render.ts src/main.ts
git commit -m "wire client loop: input, prediction, networking, placeholder render"
```

---

## Sprint 4 — Diegetic ritual feedback

**Outcome:** the ritual reads clearly with no text — pads pulse cyan/magenta when covered, the portal visibly intensifies with charge, and opening is a satisfying burst + fade-to-redirect. (Still vector/canvas effects; real sprites land in Sprint 5.)

### Task 4.1: Portal-as-charge visualization

**Files:**
- Create: `src/game/portalfx.ts`
- Modify: `src/game/render.ts`

- [ ] **Step 1: Implement a charge-driven portal effect** (concentric glow rings whose count/brightness/rotation scale with `charge`)

```ts
export function drawPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, charge: number, tMs: number) {
  const energy = charge / 100;
  const rings = 3 + Math.floor(energy * 5);
  for (let i = 0; i < rings; i++) {
    const f = i / rings;
    const r = radius * (0.4 + f * 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${260 - energy * 80}, 90%, ${55 + energy * 20}%, ${0.15 + energy * 0.5})`;
    ctx.lineWidth = 1 + energy * 3;
    ctx.stroke();
  }
  // hot core
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, `hsla(190, 100%, ${60 + energy * 30}%, ${0.4 + energy * 0.6})`);
  grad.addColorStop(1, "hsla(260, 90%, 30%, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
}
```

- [ ] **Step 2: Call `drawPortal` from the renderer** in place of the placeholder circle, passing `world.charge` and a time value.

- [ ] **Step 3: Manual verify** the portal visibly intensifies as charge climbs. Commit.

```bash
git add src/game/portalfx.ts src/game/render.ts
git commit -m "add charge-driven diegetic portal visualization"
```

### Task 4.2: Spot pulse + open burst transition

**Files:**
- Modify: `src/game/render.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Add covered-pad pulse** (covered pads get a filled glow that pulses with `tMs`; uncovered are dim dashed rings). Replace the spot loop in `render.ts` accordingly.

```ts
for (const s of world.spots) {
  const base = s.side === "left" ? "#00e0ff" : "#ff8ad1";
  const r = ROOM_CONFIG.spotRadius * sx;
  if (s.covered) {
    const pulse = 0.6 + 0.4 * Math.sin(tMs / 200);
    ctx.globalAlpha = pulse;
    const g = ctx.createRadialGradient(s.pos.x * sx, s.pos.y * sy, 0, s.pos.x * sx, s.pos.y * sy, r);
    g.addColorStop(0, base); g.addColorStop(1, "transparent");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.pos.x * sx, s.pos.y * sy, r, 0, Math.PI * 2); ctx.fill();
  } else {
    ctx.globalAlpha = 0.35; ctx.setLineDash([6, 6]); ctx.strokeStyle = base;
    ctx.beginPath(); ctx.arc(s.pos.x * sx, s.pos.y * sy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
  }
}
ctx.globalAlpha = 1;
```

- [ ] **Step 2: Add an open burst before redirect** — in `main.ts`, replace `onOpen` to play a ~900ms white-out burst, then redirect:

```ts
let opening: { url: string; start: number } | null = null;
const net = connect({
  /* onWelcome, onState unchanged */
  onOpen: (url) => { opening = { url, start: performance.now() }; },
});
// inside frame(), after drawing the world:
if (opening) {
  const k = Math.min(1, (now - opening.start) / 900);
  ctx.fillStyle = `rgba(255,255,255,${k})`;
  ctx.fillRect(0, 0, vw, vh);
  if (k >= 1) location.href = opening.url;
}
```

- [ ] **Step 3: Manual verify** the full loop feels good with two tabs. Commit.

```bash
git add src/game/render.ts src/main.ts
git commit -m "add covered-pad pulse and open-burst redirect transition"
```

---

## Sprint 5 — PixelLab art + character randomization

**Outcome:** real hi-fi pixel art replaces the placeholder shapes. Deep Void Neon palette. Palette-swapped characters with flair.

### Task 5.1: Generate assets via PixelLab MCP

**Files:**
- Create: `public/sprites/` (generated PNGs), `src/game/assets.ts`

- [ ] **Step 1: Generate the assets** using the PixelLab MCP tools (`create_character`, `animate_character`, `create_topdown_tileset`, `create_map_object`). Prompts to use:
  - Character: "hi-fi pixel art astronaut drifter, smooth shading, neon-lit visor, 4-direction top-down, ~40px" with walk + idle. Save base sheet to `public/sprites/drifter.png`.
  - Portal object: "glowing swirling space portal, violet/cyan, idle + charging + burst" -> `public/sprites/portal_*.png`.
  - Floor tileset: "dark space-station metal platform floor, subtle neon trim, top-down" -> `public/sprites/floor.png`.
  - Glow pad: "circular neon ritual pad, tintable white base" -> `public/sprites/pad.png`.
  - Background: "deep void nebula + starfield, near-black" -> `public/sprites/nebula.png`.

- [ ] **Step 2: Write `src/game/assets.ts`** — a loader that returns a promise resolving when all images are decoded.

```ts
const SRC = {
  drifter: "/sprites/drifter.png",
  portalIdle: "/sprites/portal_idle.png",
  portalCharge: "/sprites/portal_charge.png",
  portalBurst: "/sprites/portal_burst.png",
  floor: "/sprites/floor.png",
  pad: "/sprites/pad.png",
  nebula: "/sprites/nebula.png",
} as const;

export type AssetKey = keyof typeof SRC;
export type Assets = Record<AssetKey, HTMLImageElement>;

export async function loadAssets(): Promise<Assets> {
  const entries = await Promise.all(
    (Object.keys(SRC) as AssetKey[]).map(
      (k) => new Promise<[AssetKey, HTMLImageElement]>((res, rej) => {
        const img = new Image();
        img.onload = () => res([k, img]);
        img.onerror = () => rej(new Error(`failed to load ${SRC[k]}`));
        img.src = SRC[k];
      }),
    ),
  );
  return Object.fromEntries(entries) as Assets;
}
```

- [ ] **Step 3: Commit**

```bash
git add public/sprites src/game/assets.ts
git commit -m "add PixelLab-generated assets and loader"
```

### Task 5.2: Palette-swapped sprite rendering

**Files:**
- Create: `src/game/sprite.ts`
- Modify: `src/game/render.ts`, `src/main.ts`

- [ ] **Step 1: Implement hue-swap tinting** via an offscreen canvas cache keyed by hue (recolor the drifter sheet once per distinct hue, then blit frames).

```ts
const cache = new Map<number, HTMLCanvasElement>();

export function tintedSheet(base: HTMLImageElement, hue: number): HTMLCanvasElement {
  const key = Math.round(hue);
  const hit = cache.get(key);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = base.width; c.height = base.height;
  const cx = c.getContext("2d")!;
  cx.drawImage(base, 0, 0);
  cx.globalCompositeOperation = "color";
  cx.fillStyle = `hsl(${hue} 70% 50%)`;
  cx.fillRect(0, 0, c.width, c.height);
  cx.globalCompositeOperation = "destination-in"; // keep original alpha
  cx.drawImage(base, 0, 0);
  cache.set(key, c);
  return c;
}
```

- [ ] **Step 2: Replace the placeholder draws in `render.ts`** with: nebula background (drawn scaled to viewport), floor tiles, `pad.png` (tinted cyan/magenta) for spots, portal frames chosen by `charge`, and drifter frames per player using `tintedSheet(assets.drifter, cosmetics.hue)` plus a flair overlay. Pick the walk frame from `facing` + a step timer when `moving`.

- [ ] **Step 3: Gate the render loop on `loadAssets()`** in `main.ts` (await assets before starting `requestAnimationFrame`).

- [ ] **Step 4: Manual verify** real art renders, players are distinctly colored, flair shows. Commit.

```bash
git add src/game/sprite.ts src/game/render.ts src/main.ts
git commit -m "render real pixel-art sprites with per-player palette swap and flair"
```

---

## Sprint 6 — Daily links, day boundary, final deploy + docs

**Outcome:** the daily rotation is verified, contributors know how to add links, and the whole thing is live.

### Task 6.1: Day-boundary correctness test

**Files:**
- Modify: `portal-room/src/links.ts`
- Test: `test/dailypick.test.ts` (extend)

- [ ] **Step 1: Add a test** asserting `todaysLink` returns an in-range entry for several `dayId`s and is stable per day.

```ts
import { todaysLink } from "../portal-room/src/links";
test("todaysLink returns a stable, valid entry per day", () => {
  const a = todaysLink("2026-06-04");
  const b = todaysLink("2026-06-04");
  expect(a).toEqual(b);
  expect(typeof a.url).toBe("string");
});
```

- [ ] **Step 2: Run** `bun test` — expected PASS. Commit.

```bash
git add test/dailypick.test.ts
git commit -m "test daily link selection stability"
```

### Task 6.2: Contributor docs

**Files:**
- Create: `CONTRIBUTING.md`

- [ ] **Step 1: Write `CONTRIBUTING.md`** explaining: add an object to `links.json` (`url`, `title`, optional `blurb`, `addedBy`), open a PR, merging to `main` auto-deploys. Note ASCII-only commit messages (the wrangler deploy step breaks on unicode).

- [ ] **Step 2: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "add contributor guide for daily links"
```

### Task 6.3: Final deploy + verification

- [ ] **Step 1: Push to `main`** and watch the Action.

Run: `git push && gh run watch`
Expected: Worker deploy succeeds, then Pages deploy succeeds.

- [ ] **Step 2: Verify live** at the Pages URL with two devices/tabs: spawn, walk, split, charge, redirect to today's `links.json` entry.

- [ ] **Step 3: Tag the milestone**

```bash
git tag v0.1.0 && git push --tags
```

---

## Self-Review notes (author)

- **Spec coverage:** split ritual (Sprint 1 + 4), scale-with-crowd (1.2), standing-only coverage (1.4), AFK rule (1.2 idle), min-2 (1.5), zero-UI/diegetic (Sprints 3-4, no DOM HUD anywhere), daily rotating mystery destination (1.6, 2.2, 6.1), redirect-everyone (2.2 `open` + 4.2 burst), character randomization (3.1, 5.2), hi-fi pixel art (Sprint 5), DO+sibling-Worker+`script_name` (Sprint 0/2), public repo + partner PRs + Actions Worker-then-Pages + ASCII commits (Sprint 0, 6.2). All covered.
- **Open spec decisions resolved here:** day boundary = UTC (`dayIdNow`), `MAX_PER_SIDE=5`, charge rates set in `config.ts`, Space = cosmetic hop only (input captured, no gameplay use yet).
- **Type consistency:** shared `types.ts`/`config.ts`/`protocol.ts` imported by both client and worker; `tick`, `layoutSpots`, `computeCoverage`, `allCovered`, `stepCharge`, `desiredSpotsPerSide`, `activePlayerIds`, `dailyIndex` names used consistently across tasks.
