# Candy Mountain — Design

> A single-page space arena where strangers gather, perform a cooperative ritual,
> and get pulled through a portal to a hand-curated website that rotates daily.
> The name is a joke (Charlie the Unicorn). There is no candy. It stays space-themed.

- **Status:** approved design, pre-implementation
- **Date:** 2026-06-04
- **Repo:** `melonmelonz/candy-mountain` (public, so Penn's partner can contribute)
- **Hosting:** Cloudflare Pages (frontend) + sibling Worker (realtime)

---

## 1. Concept

Anyone who visits spawns as a small pixel-art astronaut and walks around a single-screen
arena with **WASD** (Space = hop / interact). In the center floats an animated portal.

To open the portal, the people currently present must perform **the split ritual**
(Section 4). When it succeeds, every connected player is **redirected** through to the
day's curated destination. The space then goes quiet until a new crowd forms and re-opens it.

The destination is a **mystery** until the moment the portal fires.

### Core principle: zero UI, zero instructions
There is **no HUD, no text, no buttons, no tutorial, no nametags**. Everything is
**diegetic** — communicated entirely through the world itself. The charge level is the
portal's own brightness/intensity; coverage is shown by spots glowing; identity is conveyed
by each player's random color and flair, not a label. A visitor arrives in a silent neon
void and discovers the ritual purely by experimenting. Sharing the experience is just
sharing the URL — there is no on-screen "invite" element.

### Goals
- Feel alive and social the instant 2+ people are present.
- Make cooperation *structurally required* — you cannot solo it, and you cannot freeload.
- Look like hi-fi space pixel art, not chunky 8-bit.
- Be cheap to run and simple to operate on Penn's existing Cloudflare stack.
- Communicate everything diegetically — no chrome, no instructions.

### Non-goals (YAGNI)
Accounts, cross-day identity, chat, leaderboards, mobile/touch controls, room sharding.
Add later only if there's a real reason.

---

## 2. Architecture

```
                    Browser (Preact SPA + Canvas)
                              |  WebSocket
                              v
   Cloudflare Pages  --bind script_name-->  Worker: portal-room/
   (static SPA + /room route)                  Durable Object: PortalRoom
                                               (one global instance)
```

### Frontend — Cloudflare Pages
- **Preact + Vite + TypeScript**, **Bun** for dev/build (matches `~/dev/wanderlost`).
- Preact is the **app shell only**: it mounts the canvas, manages the WebSocket lifecycle,
  and owns the redirect transition. It renders **no visible UI/HUD** (see zero-UI principle).
- **HTML5 Canvas** renders everything visible: starfield/nebula background, floor tileset,
  glow pads, animated portal, and players (color + flair, **no nametags**).
- All feedback is in-world: charge = portal brightness/intensity, coverage = pad glow.

### Backend — sibling Worker `portal-room/`
- Declares a Durable Object class `PortalRoom` plus `[[migrations]]` in **its own**
  `wrangler.toml` (Pages cannot declare DOs/migrations inline — known constraint).
- **One global room**: `idFromName("global")`. A single DO comfortably handles hundreds
  of WebSocket connections. Sharding is explicitly out of scope.
- Pages `wrangler.toml` binds the DO with `script_name = "portal-room"` and no migrations.
- CI deploys the **Worker first, then Pages** (ordering matters for the binding).

---

## 3. Realtime protocol & data flow

**Movement is client-authoritative; the ritual is server-authoritative.** This is a casual
co-op toy with no competitive stakes, so we relay player positions without server-side
physics. The *ritual* (spot coverage + charge) is computed on the server so it can't be faked.

- Client opens a WebSocket: Pages `/room` route -> Worker -> `PortalRoom` DO.
- Server uses **hibernatable WebSockets** (DO WebSocket Hibernation API) to avoid keeping
  the DO billed/awake when idle.

### Messages

Client -> Server:
- `hello { cosmetics }` — sent on connect; cosmetics = the client's randomized look (Section 6).
- `move { x, y, facing, moving }` — throttled to ~15 Hz.

Server -> Client:
- `welcome { id, you, spawn, playerCount, dayId }` — assigns player id + spawn point.
- `state { players[], spots[], charge }` — broadcast on the server tick (~10 Hz).
- `join { player }` / `leave { id }`.
- `open { url, title }` — the ritual completed; client runs the redirect transition.

### Server tick (~10 Hz)
1. Recompute `activePlayers` (exclude idle — see AFK rule).
2. `spotsPerSide = clamp(floor(activePlayers / 2), 1, MAX_PER_SIDE)`. Spots placed
   symmetrically on the left and right halves of the arena.
3. Determine coverage: a spot is covered if an active player stands within its radius.
4. If **every lit spot on both halves** is covered, `charge += rise`; otherwise
   `charge -= decay` (floored at 0).
5. When `charge >= 100`, broadcast `open { url, title }` for today's destination, then
   reset charge so a future crowd can re-open it.

### Rules
- **Minimum to open:** >= 2 active players (at least one per side). With fewer, the portal
  cannot charge. A solo visitor simply sees a dim, dormant portal in a quiet void — no
  prompt, no button. The emptiness itself is the call to action; sharing is just the URL.
- **AFK rule:** a player with no input for ~30 s is marked **idle** — removed from
  `activePlayers` and cannot hold a spot, so one wanderer can't stall the room. Any
  movement clears idle immediately.
- All ritual math lives in a pure, runtime-independent `roomReducer` module so it can be
  unit-tested without the Worker/DO runtime.

---

## 4. The split ritual

The arena is divided down the middle by a glowing seam. Lit spots appear on **both** the
left and right halves at once. The crowd must **split** — some cover the left spots, some
cover the right — and hold all of them **simultaneously**.

- **Fixed** spots (one set, held until charged — not a shifting sequence).
- **Standing is enough** — no timing window or synchronized jump required to charge.
- **Scales with the crowd** — more present players means more spots, so the whole crowd is
  needed and there are no freeloaders.
- Charge climbs only while every lit spot on both sides is covered; the instant one side is
  short a body, progress stalls until they rebalance.

Visual language: cyan = left team, magenta = right team (mirrors the Deep Void Neon palette).

---

## 5. Daily destination system

- `links.json` in the repo: an array of `{ url, title, blurb, addedBy }`.
- **Curated and public.** Penn's partner (and Penn) add new links via pull request. This is
  the core collaboration hook and the reason the repo is public.
- **Daily pick:** a deterministic, seeded-by-date index — stable for everyone on a given day,
  but not trivially guessable in advance. Computed by the DO at the day boundary and cached
  in DO storage (`dayId` + chosen entry).
- **Mystery:** the destination is hidden until the portal opens. There is no teaser text —
  you simply see the portal and find out where it goes only when you are pulled through. The
  portal is **re-openable all day**; the destination rotates at the day boundary.
- Day boundary timezone: **TBD at implementation** — default to UTC unless a friendlier
  local boundary is preferred. (Single decision, low risk; not blocking.)

---

## 6. Character & randomization

- One base "drifter" astronaut sprite sheet from PixelLab: 4-direction walk + idle + hop.
- **Runtime palette-swap** for suit + visor color (one sheet -> infinite cheap variety),
  plus a small random **flair** overlay chosen from a few options (antenna light, backpack
  glow, trailing particle, emblem patch).
- The randomization **seed persists in `localStorage`**, so a visitor keeps their look across
  refreshes within the same browser. No accounts, no server-side identity.
- Cosmetics are sent to the server in `hello` so other clients render the right look.

---

## 7. Art pipeline (PixelLab MCP)

Hi-fi pixel art: roughly 32-48 px sprites, rich shading and glow/bloom, **not** chunky
8-bit. Palette: **Deep Void Neon** (near-black void, electric cyan / magenta / violet) with
subtle nebula depth behind so the background is not flat black.

Assets to generate:
1. **Portal** — idle swirl, charging, and open-burst states (animated).
2. **Character** — base astronaut + 4-dir walk + idle + hop.
3. **Floor tileset** — a space-platform / station floor that reads as a slab in the void.
4. **Glow pad** — the ritual spot (tintable cyan/magenta).
5. **Background** — nebula + starfield.

---

## 8. Repository & deployment

- **Public GitHub repo** `melonmelonz/candy-mountain`.
- Layout:
  ```
  candy-mountain/
    src/                 # Preact SPA + canvas game
    public/              # generated pixel-art assets
    links.json           # curated daily destinations (partner edits via PR)
    index.html
    vite.config.ts
    wrangler.toml        # Pages config; binds PortalRoom via script_name
    portal-room/
      src/                # DO + Worker entry
      wrangler.toml       # declares PortalRoom + [[migrations]]
    .github/workflows/deploy.yml
    docs/superpowers/specs/
  ```
- **Deploy via GitHub Actions on push** (Worker first, then Pages). This intentionally
  **differs from Penn's usual direct-`wrangler` flow** because the repo is collaborative and
  push-to-deploy is the right ergonomics here.
- **Commit messages and deploy commit messages must be ASCII only** (the wrangler-action
  deploy step fails on unicode such as arrows or approximations).

---

## 9. Testing

- `bun test` over the pure logic in `roomReducer`:
  - spot-count scaling with `activePlayers`,
  - coverage detection,
  - charge rise / decay,
  - AFK -> idle transitions and their effect on `activePlayers`,
  - daily-pick determinism (same `dayId` -> same entry; different days differ).
- A light workerd/Miniflare smoke test for the WebSocket handshake if it is cheap to stand up.

---

## 10. Open decisions (non-blocking)

- Day-boundary timezone (UTC vs local). Default UTC.
- `MAX_PER_SIDE` cap and exact charge rise/decay rates — tune during implementation.
- Whether Space-to-interact gains a use beyond the cosmetic hop (left as a hook).
