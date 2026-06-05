# Candy Mountain

A zero-UI, fully diegetic co-op space-portal site. A crowd shows up, splits across
the two halves of an arena, and works together to charge a portal. When it opens,
everyone present is sent through to a single hand-picked website for the day.

There is no HUD, no menu, no instructions. Everything you need to know, the world
tells you by reacting. There is, as promised, no candy.

Live at [candy-mountain.pages.dev](https://candy-mountain.pages.dev).

## The ritual

- Everyone shares one room. Drifters spawn at random across the arena.
- The arena is split down the middle by a seam. The ritual lays out an equal
  number of charge spots on each side, and **all** of them - both halves - must be
  stood on at once for the portal's charge to rise. So the crowd has to split.
- Hold every spot and the charge climbs; let one go and it bleeds back down. At
  full charge the portal opens, everyone is sent to the day's destination, and the
  charge resets.

### The inverted far side

The far (right) half of the seam is a turned-around realm: while a drifter stands
past the seam, its movement controls invert on **both** axes - press right, walk
left; press down, walk up. The far-side spots still have to be covered, so the
crowd has to learn to move backwards over there.

Two diegetic hints make this discoverable rather than baffling, with no HUD text:

- A one-time whisper the first time you personally cross into the far half.
- A subtle photo-negative shimmer on any drifter standing past the seam.

## Daily destinations

Each day the portal opens onto a different site, chosen deterministically from
[`links.json`](./links.json) so everyone who shows up that day travels to the same
place. To add one, see [`CONTRIBUTING.md`](./CONTRIBUTING.md).

## Stack

- **Client:** Preact + Vite + TypeScript, rendered to a single full-screen canvas.
  Movement is client-side prediction; the server only clamps reported positions.
- **Realtime room:** a Cloudflare Durable Object (`PortalRoom`) in `portal-room/`,
  hosted in a sibling Worker. It runs the 10 Hz ritual tick, broadcasts world
  state over WebSockets, and uses WebSocket hibernation to survive eviction.
- **Persistence:** the Durable Object's SQLite storage holds a `portal_opens` log
  (one row per opening: UTC day, timestamp, drifters present). Game state itself
  is in-memory and ephemeral by design.
- **Hosting:** Cloudflare Pages for the SPA, plus the sibling Worker for the DO.

## Local development

```bash
bun install
bun run dev        # Vite dev server for the SPA
bun test           # the ritual logic test suite
bunx tsc --noEmit  # type check
```

The full multiplayer loop needs the Worker running too; see `portal-room/` and the
workflows in `.github/workflows/` for how the Worker and Pages site fit together.

## Deploy

```bash
bun run deploy:worker   # deploy the PortalRoom Durable Object Worker
bun run deploy:pages    # build and deploy the SPA to Cloudflare Pages
```

Commit messages and PR titles must be plain **ASCII only** - the wrangler deploy
action fails on non-ASCII characters. Use `->` instead of an arrow, and so on.

## Repo layout

- `src/` - the SPA: `src/game/` (world, render, reducer, config, sprites) and
  `src/main.ts` (the frame loop).
- `portal-room/` - the Cloudflare Worker hosting the `PortalRoom` Durable Object.
- `links.json` - the daily destination list. `screen-names.json` - the name
  generator's word lists.
- `docs/` - `SPRINT.md` working doc, plus per-feature specs and plans under
  `docs/superpowers/`.
