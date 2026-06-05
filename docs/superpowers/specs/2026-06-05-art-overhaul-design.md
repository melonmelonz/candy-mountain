# Candy Mountain Art Overhaul - Design Spec

_2026-06-05_

## Goal

A total aesthetic redo of Candy Mountain. The game loop and flow are good and
stay untouched. This is about fidelity and coherence: **super high-tech, high
fidelity space, overlaid with a retro Nintendo funk.** Pixel-art gates and pixel
characters, deliberately juxtaposed against an authentic, non-pixel high-def
space background.

Out of scope: world/ritual logic, chat, name generation, the inversion mechanic,
movement netcode. None of these change. Partner's chat stays exactly as-is.

## North star

> "think super high tek high fidelity overlaid with a retro nintendo funk"

Three layers, three fidelities, on purpose:

1. **Background** - super high-def, NOT pixel art. Smooth gradients, real-looking
   nebulae, detailed planet bodies, multi-layer parallax starfields.
2. **Portal gate** - pixel art (PixelLab warpgate), animated, sitting in the
   center as the focal artifact.
3. **Characters** - pixel art (PixelLab deities/aliens), 8-direction, higher
   fidelity than the current low-res drifters.

## Pillars / decisions

### 1. Characters: random roster spawn from 17 authored PixelLab characters

Every visitor randomly becomes one of 17 hand-picked characters. Locked roster
(name -> PixelLab character UUID, account prefix
`080f7873-d1fc-444d-9aff-ee22b01a34da`):

| Name | UUID | px |
|------|------|----|
| Medusa - Voidborne | 5ee03ea4-c95f-4243-a434-0f31450ae0ed | 92 |
| Ra - Void Sun | 562dad1d-de6d-4b30-9f4b-3553a6270c12 | 88 |
| Nyx | 55c22e33-5310-4eec-9a30-1f251feaf425 | 68 |
| Hel | abdaf8bc-c36f-43e9-a60b-6ca6fc1eb715 | 88 |
| Chang'e | 4194633e-cc65-4eb3-8f0c-45727b43aec9 | 92 |
| Ammit | d83dbb58-b624-46bc-b26f-73574935fd27 | 92 |
| Rakshasa | 4602f9c9-57cc-428e-9fdd-792854b16b05 | 96 |
| Zhong Kui | 7d36a4a1-ffb2-406d-ace5-921d466c66d4 | 92 |
| Durga | 03d0f1cf-f037-4472-92a1-a8aae564b176 | 92 |
| Thoth | 77938e01-4d99-44e2-a500-5c792929d407 | 92 |
| Thorn | 5ad98f09-0c8b-47b3-91b0-d59cc4e3c015 | 68 |
| Heavy Armor | dee205f7-2481-40d0-897c-57f1d84945cb | 68 |
| Laser Sword | a436af05-2074-4e98-b723-bbdc2205e0b2 | 184 |
| Lilac Drifter | 109e06d8-67fb-4c79-addc-33f81fa110e4 | 168 |
| Drifter | 6507e911-a823-4333-87a6-d07150548e45 | 68 |
| Red Hair | e0e0dba8-2feb-45ce-9865-b934db108a11 | 48 |
| Cindra | 96145df5-d103-465b-b93c-82dbcfd3f0e2 | 68 |

**Animation reality (varies per character):**
- All 17 have 8-direction rotation stills (south, south-east, east, north-east,
  north, north-west, west, south-west).
- Some have a full 8-direction `walking` cycle (e.g. Red Hair, the current
  drifters/aliens).
- Deities typically have only `breathing-idle` (partial directions) + `attack`,
  **no walk**.
- Some have nothing but stills.

The engine must handle this gracefully via a manifest: use `walking` frames when
moving and present for that direction; otherwise fall back to the rotation still
(engine-driven drift). "Gods adrift" - a still god gliding is on-theme. Diagonal
directions fall back to the nearest cardinal still if absent.

### 2. All assets local - nothing hits PixelLab at runtime

A build-time script downloads each character bundle
(`https://api.pixellab.ai/mcp/characters/<id>/download`, a zip of
`rotations/<dir>.png` and `animations/<name>-<hash>/<dir>/frame_NNN.png`),
composes a per-character **atlas PNG** (grid: 8 direction rows x N frame columns,
one atlas per state) plus a generated **manifest JSON** describing cell size,
directions present, frame counts, and which states exist. Output lives under
`public/sprites/roster/`. Runtime loads atlases + manifest only.

### 3. No constant bob

Remove the always-on `hoverOffset()` vertical bob. Idle characters are still
(or play their `breathing-idle` if they have one, which is the authored, subtle
version). Motion comes from actual position change + walk frames where available.

### 4. Portal: 6 animated PixelLab warpgates, daily-rotating

Six warpgates (from the user's `warpgate-all` tag, each a 1-dir 64x64 object,
animated via PixelLab `animate_object` v3 into an 8-frame `idle-swirl` loop):

| # | Object UUID | look |
|---|-------------|------|
| 0 | d371f1dc-b42f-4028-8cdb-35c6943e666e | blue spiral galaxy in stone ring |
| 1 | 219a17cd-640b-46da-9c9e-0bbebcf170b5 | red eldritch maw |
| 2 | 00556895-076a-4ca7-9c7f-1fda8fc0fcb5 | gothic blue arched gate |
| 3 | 0c074dde-67c6-4907-8ae7-cc927e2a453a | teal cosmic swirl |
| 4 | cde806b2-abef-4854-aaea-605fa7347dec | deep-purple void eye |
| 5 | cb9c27af-7a4f-4c87-ad25-4a8267ed15a8 | green nebula sphere |

Animated frames downloaded locally
(`https://api.pixellab.ai/mcp/objects/<id>/download`) into
`public/sprites/gates/`, packed as a frame strip + manifest entry. The procedural
`portalfx.ts` blob is replaced by drawing the active gate's animated frames,
scaled up, with charge driving a glow/scale/speed boost so it visibly spins up as
the crowd fills the spots. Gate art is upscaled with `image-rendering: pixelated`
crispness preserved (nearest-neighbor draw).

### 5. "Day" = a solve (cycle), not a calendar day

Currently the destination is chosen by UTC day via `todaysLink(dayId)` /
`dailyIndex`. New model: each time the crowd solves the portal counts as one
cycle. The cycle index is the count of rows in the existing SQLite `portal_opens`
table (the first real *read* of that table - previously write-only). On open:
redirect everyone to the current cycle's site, then the room advances to the next
cycle, showing the **next gate + next site**.

- `cycleIndex` = `SELECT COUNT(*) FROM portal_opens` (server-authoritative).
- Active gate = `gates[cycleIndex % 6]`.
- Active site = `links[cycleIndex % links.length]`.
- The active gate id is broadcast to clients (in `welcome` and `state`) so the
  client knows which gate art to draw. The client must NOT compute its own
  calendar pick for the gate; it follows the server's cycle.

Diff portal + diff site every time it's solved.

### 6. Step-on spots stay portal-agnostic

The charge spots and their energy streams keep a neutral cool palette
(white/cyan), independent of whichever gate is active that cycle. They do not
color-match the portal.

### 7. Background: high-def procedural parallax space (no pixel art)

Replace the flat fill + single nebula + 140 star-rects with a layered,
full-resolution (non-pixelated) renderer:
- Deep gradient base (near-black with subtle color temperature variation).
- 2-3 soft nebula clouds (large radial/blurred gradients, low alpha, slowly
  drifting and breathing).
- 3 parallax star layers (far/mid/near) with varying size, brightness, and a
  gentle autonomous drift; near layer twinkles subtly.
- 1-2 detailed planet bodies: radial body shading + atmosphere rim light + a
  terminator shadow, placed off to the sides, slowly drifting.
- Rendered with smoothing ON (the opposite of the sprites) so it reads as
  authentic high-def, juxtaposed against the crisp pixel gate/characters.
- Optional charge reactivity: as charge rises, stars drift faster toward the gate
  / nebula warms. Subtle; keep it tasteful.

### 8. Redirect rework (replace the "corny" transmission)

When the portal solves and we redirect, "a lot of care." Replace the text
transmission + white flash with a smooth, coherent **CRT collapse + dive**:
- The active gate ramps its swirl fast and blooms (using its own frames + glow).
- A brief CRT collapse over the whole canvas: horizontal-line scan, vertical
  squeeze to a bright center line, RGB-split shimmer, then snap to black.
- Then `location.href` to the day's site.
- No transmission text, no plain white engulf.

### 9. Spawn-side funnel + guiding wisp + cinematic camera lock

Three-part onboarding flow so the crowd gathers before the split ritual begins:

**Spawn on the non-inverted side, away from the gate.** Drifters never appear on
top of the portal and never in the inverted (right) realm. The server constrains
every spawn to the left half (`x < seamX - SEAM_BUFFER`) and rejects any roll
within `MIN_PORTAL_DIST` of the gate center, so everyone starts out on the safe
side with a journey inward.

**Guiding wisp.** To point the way without any HUD, each player gets a small,
soft "tinkerbell" wisp - a faint glowing mote with a short sparkle trail - that
floats just ahead of them toward the gate. Personal nav aid: local player only
(remotes would clutter). It fades out as the player nears the gate and is gone
once within range. Subtle, on-theme with the "retro nintendo funk."

**Cinematic camera lock.** Each client's view starts framed on the left spawn
side (a gentle uniform zoom, ~1.3x, focused left-of-center, with the gate visible
toward the edge). The moment the local drifter funnels in within `LOCK_DIST` of
the gate, the camera smoothly eases (one-way latch, ~1s ease-in-out) back to the
full ritual frame: zoom -> 1.0 and focus -> arena center, re-centering on the
gate and pulling the right/inverted half and both sides' spots into view. The
camera is a uniform zoom-about-focus transform that reduces *exactly* to the
current full-arena stretch render when locked, so the rest of the renderer is
unchanged. Purely cinematic and per-client; it does not restrict movement. (A
fresh page load / next cycle resets it via redirect.)

## Architecture / file structure

New:
- `scripts/fetch-sprites.ts` (Bun) - downloads all 17 character bundles + 6 gate
  bundles, composes atlases, writes manifests. Run manually, output committed.
- `public/sprites/roster/<name>/atlas-*.png` + `public/sprites/roster/manifest.json`
- `public/sprites/gates/<id>.png` + `public/sprites/gates/manifest.json`
- `src/game/roster.ts` - roster manifest types + loader (replaces the old SHEETS
  concept in assets.ts for characters).
- `src/game/background.ts` - the high-def parallax space renderer.
- `src/game/gate.ts` - animated gate renderer (replaces portalfx.ts).
- `src/game/redirect.ts` - the CRT collapse + dive transition.

Modified:
- `src/game/assets.ts` - load roster atlases + gate frames + manifests.
- `src/game/sprite.ts` - 8-direction, manifest-driven frame selection; keep the
  negative-shimmer (far-side) effect, adapt to new sprite format.
- `src/game/render.ts` - use background.ts + gate.ts; remove `hoverOffset` bob;
  draw active gate; keep seam/spots/streams (spots neutral); draw 8-dir sprites.
- `src/game/config.ts` - `SPRITE_SHEET_COUNT` -> roster count (17); add gate
  count (6).
- `src/game/types.ts` - cosmetics `sprite` index now spans 17; add `gateId` to
  wire/room state.
- `src/protocol.ts` - add active `gateId` to `welcome` + `state` messages.
- `src/main.ts` - use redirect.ts for the open cinematic; pass gateId through.
- `portal-room/src/room.ts` - compute `cycleIndex` from `portal_opens` count;
  broadcast active `gateId`; pick link by cycle not day.
- `portal-room/src/links.ts` - add a `linkForCycle(index)` alongside/!instead of
  `todaysLink`.

## Testing

- `bun test` for the cycle-index pick logic (gate + link selection are pure
  functions of an integer index; test modulo wrap, empty list).
- `bunx tsc --noEmit` clean.
- Manual: dev preview harness to eyeball background, each gate, the 17 sprites in
  8 directions, idle vs moving, the redirect transition.

## Open risk

The 6 gate animations are generating now (async). If any come back ugly, swap in
another of the 16 `warpgate-all` objects. The fetch script's gate list is a
simple array - easy to edit and re-run.
