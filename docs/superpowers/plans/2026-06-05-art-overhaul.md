# Candy Mountain Art Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Total aesthetic redo - high-def parallax space background, 17 random-spawn PixelLab characters (8-dir), 6 daily-rotating animated PixelLab warpgates, "day = a solve" cycle, no constant bob, and a smooth CRT-collapse redirect. All assets local.

**Architecture:** Build-time fetch script pulls PixelLab bundles into `public/sprites/` as atlases + manifests. Runtime loads local atlases only. Background is full-res procedural (smoothing on); gate + characters are crisp pixel art (nearest-neighbor). Server drives a cycle index off the existing SQLite `portal_opens` count and broadcasts the active gate id.

**Tech Stack:** Preact + Vite + TypeScript + Bun, Canvas 2D, Cloudflare DO Worker.

**Spec:** `docs/superpowers/specs/2026-06-05-art-overhaul-design.md` (read it for the full roster table, gate list, and rationale).

---

## Conventions for all tasks

- ASCII-only commit messages (wrangler deploy breaks on unicode). Use `->`.
- `bunx tsc --noEmit` must stay clean. `bun test` must pass.
- Pixel art draws with `ctx.imageSmoothingEnabled = false`; background draws with it `true`. Set it explicitly per layer; never assume global state.
- Account prefix for all PixelLab URLs: `080f7873-d1fc-444d-9aff-ee22b01a34da`.

---

## Task 1: Asset fetch script + generated local assets

**Files:**
- Create: `scripts/fetch-sprites.ts`
- Create (generated, committed): `public/sprites/roster/manifest.json`, `public/sprites/roster/<slug>/<state>.png`, `public/sprites/gates/manifest.json`, `public/sprites/gates/<id>.png`
- Reference: spec roster table (17 chars) + gate table (6 gates)

**What the script does** (Bun, run via `bun run scripts/fetch-sprites.ts`):

1. For each of the 17 characters: GET `https://api.pixellab.ai/mcp/characters/<id>/download` (a zip). Unzip in a temp dir. The zip contains `<Name>/rotations/<dir>.png` and `<Name>/animations/<state>-<hash>/<dir>/frame_NNN.png`.
2. For each character, compose one **atlas PNG per state** plus a `rotations` atlas:
   - `rotations.png`: a single row of 8 cells in fixed direction order `[south, south-east, east, north-east, north, north-west, west, south-west]`. Missing directions: leave that cell transparent (manifest records which are present).
   - For each animation state present (e.g. `walking`, `breathing-idle`, `attack`): `<state>.png` grid of rows = the 8 directions (same fixed order), cols = frames. Rows for absent directions are transparent.
   - Cell size = the character's native px (from the PNG dimensions; all frames of one character share a size).
3. Write `public/sprites/roster/manifest.json`:

```json
{
  "characters": [
    {
      "slug": "medusa-voidborne",
      "name": "Medusa - Voidborne",
      "cell": 92,
      "dirOrder": ["south","south-east","east","north-east","north","north-west","west","south-west"],
      "rotations": { "file": "medusa-voidborne/rotations.png", "dirs": ["south","east","north","west","south-east","north-east","north-west","south-west"] },
      "states": {
        "breathing-idle": { "file": "medusa-voidborne/breathing-idle.png", "frames": 4, "dirs": ["south","west","east"] },
        "attack": { "file": "medusa-voidborne/attack.png", "frames": 7, "dirs": ["west","east","south"] }
      }
    }
  ]
}
```

   - `characters[]` order is the canonical roster index (0..16) and MUST match the spec table order exactly (Medusa=0 ... Cindra=16).
   - `dirs` per state/rotations lists only directions actually present.
4. For the 6 gates: GET `https://api.pixellab.ai/mcp/objects/<id>/download`. Each zip has `rotations/unknown.png` and `animations/<group>/unknown/frame_NNN.png` (9 frames). Compose `<id>.png` = a single row strip of the 9 animation frames (or the static rotation as 1 frame if animation missing). Write `public/sprites/gates/manifest.json`:

```json
{
  "gates": [
    { "id": "d371f1dc-b42f-4028-8cdb-35c6943e666e", "cell": 64, "frames": 9, "file": "d371f1dc-b42f-4028-8cdb-35c6943e666e.png" }
  ]
}
```

   - `gates[]` order MUST match the spec gate table (index 0..5). This index is what the server's `cycleIndex % 6` selects.

**Image composition in Bun:** use the `sharp` package (add as devDependency) for unzip-free PNG compositing, or `unzipper`/`adm-zip` + `sharp`. Pick one approach; keep it in devDependencies only.

- [ ] **Step 1:** Add devDependencies needed (`sharp`, a zip reader). `bun add -d sharp adm-zip @types/adm-zip`.
- [ ] **Step 2:** Write `scripts/fetch-sprites.ts` per the contract above. Make the character list and gate list top-of-file arrays (name+id) so they are easy to edit.
- [ ] **Step 3:** Run `bun run scripts/fetch-sprites.ts`. Verify `public/sprites/roster/manifest.json` has 17 entries and `public/sprites/gates/manifest.json` has 6 entries, and that the PNGs exist and open.
- [ ] **Step 4:** Spot-check 2-3 atlases visually (open the PNG) - directions in the right cells, no obvious corruption.
- [ ] **Step 5:** Commit script + generated assets. `git add scripts/fetch-sprites.ts public/sprites package.json` and commit "feat: add sprite fetch script and local roster + gate assets".

**Note:** If any gate animation is still generating when the script runs, the gate zip will lack animation frames - the script should fall back to the static rotation as a 1-frame strip and log a warning so we can re-run later.

---

## Task 2: Roster + gate manifest loaders

**Files:**
- Create: `src/game/roster.ts`
- Modify: `src/game/assets.ts`
- Test: `test/roster.test.ts`

**Contract:**

```ts
// roster.ts
export type Dir8 = "south"|"south-east"|"east"|"north-east"|"north"|"north-west"|"west"|"south-west";
export const DIR_ORDER: Dir8[] = ["south","south-east","east","north-east","north","north-west","west","south-west"];

export interface StateDef { file: string; frames: number; dirs: Dir8[]; }
export interface CharDef {
  slug: string; name: string; cell: number; dirOrder: Dir8[];
  rotations: { file: string; dirs: Dir8[] };
  states: Record<string, StateDef>;
}
export interface RosterManifest { characters: CharDef[]; }

export interface GateDef { id: string; cell: number; frames: number; file: string; }
export interface GateManifest { gates: GateDef[]; }

// 4-dir wire facing -> Dir8 cardinal
export function facingToDir8(f: "up"|"down"|"left"|"right"): Dir8;
// nearest present direction for a char/state, falling back across the manifest dirs
export function resolveDir(want: Dir8, available: Dir8[]): Dir8 | null;
```

- [ ] **Step 1:** Write `test/roster.test.ts` testing `facingToDir8` (down->south, up->north, left->west, right->east) and `resolveDir` (returns exact if present; returns a sensible nearest when absent; returns null when `available` empty).
- [ ] **Step 2:** Run `bun test test/roster.test.ts` - expect FAIL (functions not defined).
- [ ] **Step 3:** Implement `roster.ts` with the types + the two pure functions. `resolveDir`: if `want` in available return it; else pick the available dir minimizing angular distance in `DIR_ORDER` index space (wrap-aware); empty -> null.
- [ ] **Step 4:** Run `bun test test/roster.test.ts` - expect PASS.
- [ ] **Step 5:** In `assets.ts`, add loaders that `fetch('/sprites/roster/manifest.json')` and `fetch('/sprites/gates/manifest.json')`, then load every atlas PNG referenced into `HTMLImageElement`s keyed by file path. Expose via the existing `Assets` interface (extend it: `roster: RosterManifest`, `gates: GateManifest`, `images: Map<string, HTMLImageElement>`). Keep the old drifter `SHEETS` loading ONLY if still referenced; otherwise remove it. Preserve the load-with-fallback robustness (one bad atlas must not blank the game - fall back to a 1x1 transparent image and log).
- [ ] **Step 6:** `bunx tsc --noEmit` clean. Commit "feat: roster + gate manifest loaders".

---

## Task 3: 8-direction manifest-driven sprite renderer

**Files:**
- Modify: `src/game/sprite.ts`
- Test: `test/sprite-frame.test.ts`

**Goal:** Replace the single-sheet 4-row/7-col `drawDrifter` with a manifest-driven renderer that draws character `index` (0..16), picking state + direction + frame from atlases. Remove all hue-tint logic tied to the old monochrome drifter (the authored characters carry their own color; `tintedSheet` and cosmetics.hue tinting are dropped for characters). Keep `drawNegativeShimmer` (far-side effect) but adapt it to the new atlas draw.

**Frame selection rules:**
- Idle (not moving): if char has `breathing-idle` for the resolved dir, play it at ~4 fps; else draw the rotation still for the resolved dir. NO synthetic bob.
- Moving: if char has `walking` for the resolved dir, play it at ~10 fps; else draw the rotation still (engine drift carries the motion).
- Direction: `resolveDir(facingToDir8(facing), state.dirs OR rotations.dirs)`.

**Contract:**
```ts
export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  assets: Assets, charIndex: number,
  facing: Facing, moving: boolean,
  px: number, py: number, drawScale: number, tMs: number,
): void;
export function drawNegativeShimmerChar(/* same params */): void; // far-side negative overlay
```

`drawScale` maps the character's native `cell` px to on-screen size. Pick a target on-screen height (e.g. ~72 device px like the old `72*sx` portal scale baseline) so wildly different native sizes (48 vs 184) normalize to a consistent in-world footprint. Compute `drawScale = TARGET_PX / cell`. Draw with `imageSmoothingEnabled=false`.

- [ ] **Step 1:** Write `test/sprite-frame.test.ts` for the pure frame-index helper: a function `pickFrame(fps, frames, tMs)` returning `Math.floor(tMs/(1000/fps)) % frames`, and `selectState(charDef, moving)` returning `"walking"|"breathing-idle"|null` per the rules + availability. Test wrap and fallbacks.
- [ ] **Step 2:** `bun test test/sprite-frame.test.ts` - expect FAIL.
- [ ] **Step 3:** Implement helpers + `drawCharacter` + `drawNegativeShimmerChar` in `sprite.ts`. Read atlases from `assets.images` by file path; cells laid out rows=dir(DIR_ORDER index), cols=frame. Keep the negative-shimmer compositing technique (difference vs white, destination-in alpha) but source from the selected atlas cell.
- [ ] **Step 4:** `bun test test/sprite-frame.test.ts` - expect PASS.
- [ ] **Step 5:** `bunx tsc --noEmit` clean (render.ts will temporarily break - that's Task 5; if needed, keep old exports until render.ts is updated, but prefer doing Task 5 right after). Commit "feat: 8-dir manifest-driven character renderer".

---

## Task 4: High-def parallax space background

**Files:**
- Create: `src/game/background.ts`
- Modify: `src/game/render.ts` (swap `drawBackground`)

**Contract:**
```ts
export interface BgState { /* internal layer caches */ }
export function createBackground(w: number, h: number): BgState;
export function drawBackground(ctx, bg: BgState, w, h, tMs, charge: number): void;
```

Layers (smoothing ON, full res, no pixelation):
- Deep gradient base, near-black with subtle blue/violet temperature variation.
- 2-3 soft nebula clouds: large radial gradients, low alpha, slow drift + breathing (sin over tMs).
- 3 parallax star layers (far/mid/near): generated once into offscreen canvases (or arrays), drifting at different speeds; near layer twinkles (per-star sin alpha).
- 1-2 planet bodies: radial body shading + atmosphere rim (lighter arc) + terminator shadow; slow drift; placed toward edges so they don't fight the central gate.
- Subtle charge reactivity: as `charge` (0..100) rises, nudge star drift speed and warm the nearest nebula slightly. Keep tasteful.

- [ ] **Step 1:** Implement `background.ts` per contract. Stars seeded deterministically (no per-frame allocation in the draw loop). Resize handled by `createBackground` being re-called on canvas resize.
- [ ] **Step 2:** In `render.ts`, replace the old flat-fill/STARS `drawBackground` with `createBackground`/`drawBackground`. Remove the old `STARS` array + single-nebula code. Ensure smoothing is reset to `false` before drawing pixel-art layers afterward.
- [ ] **Step 3:** `bunx tsc --noEmit` clean. Visual check in dev harness: layered, smooth, drifting, not pixelated. Commit "feat: high-def parallax space background".

---

## Task 5: Animated gate renderer + render.ts integration

**Files:**
- Create: `src/game/gate.ts`
- Delete: `src/game/portalfx.ts`
- Modify: `src/game/render.ts`

**Contract:**
```ts
export function drawGate(
  ctx, assets: Assets, gateId: string,
  cx: number, cy: number, drawScale: number,
  charge: number, tMs: number,
): void;
```

- Look up gate in `assets.gates.gates` by id; draw its frame strip (`assets.images[file]`), cell = gate.cell, cols = frames. Play loop ~8-10 fps; `charge` increases playback speed slightly and adds an additive glow (radial gradient behind, alpha scaling with charge). Nearest-neighbor draw (`imageSmoothingEnabled=false`). Scale up from 64px to a strong central presence (match/exceed the old `72*sx` footprint; gate should read as the focal artifact).
- If `gateId` not found, draw nothing (background still shows) and log once.

**render.ts integration:**
- Replace the `drawPortal(...)` call (from portalfx.ts) with `drawGate(ctx, assets, world.gateId, cx, cy, gateScale, world.charge, tMs)`.
- Remove `hoverOffset()` entirely and all call sites - characters no longer bob. Use raw interpolated positions.
- Replace `drawDrifter`/old sprite calls with `drawCharacter(...)` using `player.cosmetics.sprite` as charIndex; remotes + self.
- Keep seam rendering, spot rendering, and energy streams, but ensure spots/streams use the neutral cool palette (white/cyan) and do NOT derive color from the gate.
- Adapt the far-side negative shimmer to `drawNegativeShimmerChar`.
- `world.gateId` is new client state (see Task 6/7) - thread it through.

- [ ] **Step 1:** Implement `gate.ts`.
- [ ] **Step 2:** Update `render.ts`: remove portalfx import + `hoverOffset`, wire `drawGate` + `drawCharacter`, neutralize spot/stream colors. Delete `portalfx.ts`.
- [ ] **Step 3:** `bunx tsc --noEmit` clean. Visual check: gate animates, scales with charge, characters don't bob, spots are cool-neutral. Commit "feat: animated gate renderer, drop procedural portal and bob".

---

## Task 6: Server cycle-index + gate broadcast + link-by-cycle

**Files:**
- Modify: `portal-room/src/links.ts`
- Modify: `portal-room/src/room.ts`
- Modify: `src/protocol.ts`
- Modify: `src/game/types.ts`
- Modify: `src/game/config.ts`
- Create: `src/game/gatepick.ts`
- Test: `test/cyclepick.test.ts`

**Contract (`gatepick.ts`):**
```ts
export const GATE_IDS: string[] = [
  "d371f1dc-b42f-4028-8cdb-35c6943e666e",
  "219a17cd-640b-46da-9c9e-0bbebcf170b5",
  "00556895-076a-4ca7-9c7f-1fda8fc0fcb5",
  "0c074dde-67c6-4907-8ae7-cc927e2a453a",
  "cde806b2-abef-4854-aaea-605fa7347dec",
  "cb9c27af-7a4f-4c87-ad25-4a8267ed15a8",
];
export function gateForCycle(index: number): string; // GATE_IDS[((index % n)+n)%n]
```

**Contract (`links.ts`):** add `linkForCycle(index: number): Link | undefined` = `list[((index % len)+len)%len]`. Keep `todaysLink` only if still used elsewhere; otherwise remove.

**protocol.ts:** add `gateId: string` to `welcome` and to `state`:
```ts
| { t: "welcome"; id: PlayerId; spawn: {x:number;y:number}; dayId: string; gateId: string }
| { t: "state"; players: PlayerWire[]; spots: Spot[]; charge: number; gateId: string }
```

**room.ts changes:**
- Add `private cycleIndex = 0;`. In the constructor, after creating the table, set `this.cycleIndex = this.countOpens();` where `countOpens()` runs `SELECT COUNT(*) AS n FROM portal_opens` and reads `n`.
- Add helper `private activeGateId(): string { return gateForCycle(this.cycleIndex); }`.
- In `fetch()` welcome send: include `gateId: this.activeGateId()`.
- In `alarm()` broadcast: include `gateId: this.activeGateId()`.
- On `result.opened`: after the existing INSERT, increment `this.cycleIndex++` (so the next broadcast shows the next gate). Use `linkForCycle(this.cycleIndex - 1)` for the just-solved redirect URL (the cycle that was active when it opened), i.e. compute the link BEFORE incrementing, or capture `const solvedIndex = this.cycleIndex; ...; this.cycleIndex++;` and use `linkForCycle(solvedIndex)`. Replace the `todaysLink(dayId)` call accordingly.

**config.ts:** rename `SPRITE_SHEET_COUNT = 3` -> `ROSTER_COUNT = 17`; update `room.ts` import + sanitize bound. Add `export const GATE_COUNT = 6;`.

**types.ts:** update the `sprite` comment to "index into the 17-char roster (0..ROSTER_COUNT-1)". Add `gateId: string` to `RoomState` if the reducer/test needs it; otherwise keep gateId purely in wire + client world state.

- [ ] **Step 1:** Write `test/cyclepick.test.ts`: `gateForCycle` wraps (0->id0, 6->id0, negative-safe), `linkForCycle` wraps over a small fake list and returns undefined for empty.
- [ ] **Step 2:** `bun test test/cyclepick.test.ts` - expect FAIL.
- [ ] **Step 3:** Implement `gatepick.ts` + `linkForCycle`.
- [ ] **Step 4:** `bun test test/cyclepick.test.ts` - expect PASS.
- [ ] **Step 5:** Apply room.ts + protocol.ts + types.ts + config.ts changes. Read room.ts current code first; preserve all existing behavior (hibernation re-adopt, chat, rate limits, SQLite write). `bunx tsc --noEmit` clean across both tsconfigs.
- [ ] **Step 6:** `bun test` full suite passes. Commit "feat: day-equals-a-solve cycle, broadcast active gate, link-by-cycle".

---

## Task 7: Client - random roster spawn + consume server gateId

**Files:**
- Modify: `src/main.ts`
- Modify: client world state (wherever `welcome`/`state` are handled and `world` is built)

- Random spawn sprite: pick `Math.floor(Math.random()*ROSTER_COUNT)` for the local player's `cosmetics.sprite` (replace the old `SPRITE_SHEET_COUNT` random). Keep cosmetics persistence behavior (localStorage) but the sprite index now spans 17; clamp any stale stored value.
- Store `world.gateId` from `welcome` and update it from every `state` message. Pass it into `drawGate` via render.
- Remote players already carry `cosmetics.sprite`; render uses it as charIndex.

- [ ] **Step 1:** Read `src/main.ts`; locate cosmetics init + the `welcome`/`state` handlers + world construction.
- [ ] **Step 2:** Wire random roster index, gateId into world state, clamp stale stored sprite. `bunx tsc --noEmit` clean.
- [ ] **Step 3:** Visual check: refresh spawns different characters; gate matches server. Commit "feat: random roster spawn and server-driven gate selection".

---

## Task 8: Redirect - CRT collapse + dive (replace transmission)

**Files:**
- Create: `src/game/redirect.ts`
- Modify: `src/main.ts` (the `opening` cinematic block, ~lines 232-249)

**Contract:**
```ts
// progress p in 0..1 over the cinematic duration; returns true when done
export function drawRedirect(ctx, w, h, p: number, gateDraw: () => void): void;
```

Sequence (tasteful, ~1.2-1.6s):
- Phase A (0..0.5): the active gate ramps fast + blooms (call `gateDraw()` which renders the active gate at boosted speed/glow), rest of scene dims.
- Phase B (0.5..0.85): CRT collapse over the whole canvas - horizontal scanlines intensify, vertical squeeze toward a bright center line, slight RGB-split.
- Phase C (0.85..1.0): center line flares then snaps to black.
- At p>=1: `location.href = url`.

Remove the old transmission text lines + plain white engulf. Keep using `drawOpenBloom` only if it composes with the new sequence; otherwise fold its bloom into Phase A and remove it.

- [ ] **Step 1:** Implement `redirect.ts`.
- [ ] **Step 2:** Replace the cinematic in `main.ts` to drive `drawRedirect` with elapsed/duration and navigate at completion. Read the current block first; preserve how `opening` is set from the `open` server msg (url/title).
- [ ] **Step 3:** `bunx tsc --noEmit` clean. Visual check: solve -> smooth CRT collapse -> navigate, no corny text/flash. Commit "feat: CRT-collapse redirect, drop transmission cinematic".

---

## Task 9: Final cleanup + docs

**Files:**
- Modify: `docs/SPRINT.md`
- Delete: any now-dead code (old `tintedSheet` if unused, old `SHEETS`, `portalfx.ts` already gone, old drifter pngs under `public/sprites/` if replaced)
- Modify: `README.md` (art/stack section if needed)

- [ ] **Step 1:** Grep for dead references (`SPRITE_SHEET_COUNT`, `drawDrifter`, `drawPortal`, `hoverOffset`, `todaysLink`, `STARS`, `tintedSheet`). Remove unused. `bunx tsc --noEmit` clean.
- [ ] **Step 2:** `bun test` full suite + `bunx tsc --noEmit` both clean.
- [ ] **Step 3:** Update `docs/SPRINT.md` "Recently shipped" with the art overhaul; note cycle model + local assets.
- [ ] **Step 4:** Commit "chore: prune dead art code and update sprint doc".

---

## Final review

After all tasks: dispatch a final code reviewer over the whole branch, then use superpowers:finishing-a-development-branch. Deploy is manual: `bun run deploy:worker` then `bun run deploy:pages` (CI token still unset).
