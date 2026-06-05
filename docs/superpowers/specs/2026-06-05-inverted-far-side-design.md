# Inverted Far Side — Design

**Date:** 2026-06-05

## Goal

Add a puzzle twist to the split-ritual: while a drifter stands on the far
(right) side of the arena seam, its movement controls invert on both axes.
Players must discover and adapt to the reversal to cover the far-side ritual
spots and open the portal. Two diegetic, zero-UI hints make the twist
discoverable rather than baffling.

## Context

The arena (1280x720) is already split at `seamX = 640` into a left and right
half. The ritual already forces the crowd to split across both halves: the
reducer lays out an equal number of spots on each side
(`desiredSpotsPerSide`, `layoutSpots`) and **all** spots — both sides — must
be covered simultaneously for charge to rise (`allCovered`, `stepCharge`).
So the crossing into the far half is already a required, shared act. This
feature makes the far half fight back.

Movement is pure client-side prediction in `stepSelf` (`src/game/world.ts`).
The server (`portal-room/src/room.ts`) only clamps the position a client
reports; it does not simulate movement. Therefore the inversion is entirely a
client concern — no server or reducer change is required.

The game is fully diegetic (no HUD). It already has a transient "whisper"
channel (`drawWhisper` in `src/game/render.ts`, driven from `src/main.ts`)
used for charge-band flavor lines. The first-crossing hint reuses this exact
channel.

## Scope

### In scope

1. **Control inversion** on the far side, in `stepSelf`.
2. **First-crossing whisper** (hint #2): a one-time, local-to-self whisper the
   first time the player crosses from the near half into the far half.
3. **Negative shimmer** (hint #3): a subtle photo-negative tint on any drifter
   (self or remote) whose position is past the seam.

### Out of scope (explicitly declined)

- No spawn change. Random spawn across the whole arena stays as-is.
- No "capsized realm" background treatment. The far half looks identical to
  the near half except for the per-drifter shimmer.
- No server, reducer, or protocol change.
- No charge-tuning change. (`chargeDecayPerTick` is noted as a future knob if
  full inversion proves too punishing, but is NOT touched here.)

## Design

### 1. Control inversion (`src/game/world.ts`, `stepSelf`)

Today `stepSelf` derives a movement vector from input booleans:

```ts
let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
```

Add: when the drifter is on the far side of the seam, negate both axes
*before* the vector is used for movement and facing:

```ts
if (world.self.x > SEAM_X) { dx = -dx; dy = -dy; }
```

Because facing is derived from `dx`/`dy` *after* this negation, the drifter
visibly walks opposite the player's input — the honest, learnable tell.
Crossing back to the near side (`x <= SEAM_X`) restores normal control on the
next frame, which also telegraphs where the boundary lies.

The seam constant: `stepSelf` already imports `ROOM_CONFIG` from `./config`,
which exposes `seamX`. Use `ROOM_CONFIG.seamX` directly (no new constant).

Boundary rule: inversion applies when `world.self.x > ROOM_CONFIG.seamX`
(strictly greater). At exactly the seam, control is normal.

### 2. First-crossing whisper (`src/main.ts`)

Track whether the self drifter is currently on the far side and whether the
first-crossing whisper has already fired this session:

- Maintain `let wasFarSide = false;` and `let crossedOnce = false;` in the
  module scope of `main.ts` (alongside the existing `whisper`/`lastBand`
  state).
- Each frame, after `stepSelf`, compute `const farSide = world.self.x >
  ROOM_CONFIG.seamX;`.
- When `farSide && !wasFarSide && !crossedOnce`: set `crossedOnce = true` and
  trigger a whisper using the existing whisper mechanism
  (`whisper = { text: <line>, start: now }`), so it rides the same fade
  envelope already implemented for band whispers.
- Always update `wasFarSide = farSide;` at the end.

The whisper line is a single cryptic-but-true string. Chosen line:

> `"past the seam, the world turns against you"`

`main.ts` will need `ROOM_CONFIG` imported from `./game/config` (it is not
currently imported there).

Rationale for "once per session, local to self": the whisper is a personal
discovery aid. Re-showing it on every crossing would be noise; showing it to
players who never cross would spoil the surprise. `crossedOnce` is plain
session state — no persistence.

### 3. Negative shimmer on far-side drifters (`src/game/render.ts`)

When drawing a drifter whose world-x is past the seam, overlay a subtle
photo-negative tint so the figure reads as "turned around." This applies to
both the self drifter and remote drifters, computed from each drifter's own
position.

Implementation approach: after the normal sprite blit for a drifter, if its
x is past `ROOM_CONFIG.seamX`, draw the same sprite cell again on top using
`globalCompositeOperation = "difference"` against a near-white fill clipped to
the sprite, OR apply a low-alpha inverted-hue overlay. The exact compositing
is an implementation detail to be tuned in the preview harness; the
requirement is: **a clearly perceptible-but-subtle negative shimmer that is
keyed strictly to `drifterX > ROOM_CONFIG.seamX`, with no effect on near-side
drifters.**

`render.ts` already imports the sprite-drawing helpers and `SHEETS`; it will
need `ROOM_CONFIG` from `./config` if not already imported.

Note: this is the one tell the user marked as "maybe." It is included, but is
the lowest-priority of the three changes — if it cannot be made to look good
without visual noise, it may be dropped without affecting the core mechanic or
the whisper hint.

## Components and data flow

- **Input -> inversion:** `input.state` (booleans) -> `stepSelf` negates the
  vector when `self.x > seamX` -> updates `self.x/y` and `self.facing`.
- **Position -> server:** unchanged. `main.ts` sends the predicted position;
  server clamps to arena bounds and rebroadcasts.
- **Position -> whisper:** `main.ts` reads `self.x` each frame, fires the
  one-time whisper on the near->far transition.
- **Position -> shimmer:** `render.ts` reads each drifter's x while drawing and
  applies the negative overlay past the seam.

## Edge cases

- **Spawning on the far side:** because spawn is unchanged and random, a player
  may spawn already past the seam. Their controls are inverted from frame one,
  and `wasFarSide` initializes to `false`, so the first-crossing whisper fires
  on their first frame on the far side (acceptable — they get the hint
  immediately). If this proves to fire spuriously at spawn before the welcome
  position is applied, initialize `wasFarSide` from the spawn position in the
  `onWelcome` handler.
- **Hovering on the seam:** rapidly crossing back and forth flips control each
  frame. This is acceptable and even informative (it reveals the boundary). No
  hysteresis/deadzone is added.
- **Remote drifters:** the shimmer is computed per-drifter from interpolated
  position, so a remote straddling the seam shimmers consistent with where it
  is drawn.

## Testing

- **Unit (`stepSelf`):**
  - Near side (`x <= seamX`): pressing right moves +x, pressing down moves +y
    (unchanged behavior).
  - Far side (`x > seamX`): pressing right moves -x, pressing down moves -y;
    facing reflects actual motion (e.g. pressing right yields facing "left").
  - Boundary: a drifter just past the seam inverts; moving back across restores
    normal control.
- **Visual (preview harness):** confirm the negative shimmer is visible-but-
  subtle on far-side drifters and absent on near-side drifters; confirm the
  first-crossing whisper renders through the existing whisper envelope.
- Existing `tsc --noEmit` clean and `bun test` green must be preserved.
