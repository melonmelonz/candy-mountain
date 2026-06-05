# Candy Mountain — Sprint / Working Doc

_Last updated: 2026-06-05_

A lightweight living doc tracking what's shipped, what's next, and the backlog.
Per-feature design specs and step-by-step plans live in
`docs/superpowers/specs/` and `docs/superpowers/plans/`.

## What the project is

A zero-UI, fully diegetic co-op space-portal site. A crowd splits across the two
halves of the arena to charge a portal; when it opens it sends everyone to a
daily curated link. No HUD — everything is the world reacting.

**Stack:** Preact + Vite + TypeScript + Bun. Cloudflare Pages (SPA) + a sibling
Worker hosting the `PortalRoom` Durable Object (SQLite-backed). Deploy via
`bun run deploy:worker` then `bun run deploy:pages`. Commit messages must be
ASCII-only (the wrangler deploy action breaks on unicode).

## Recently shipped

- **Art overhaul** (`f84d931`): fixed the left/right "boxes" sprite artifact,
  reworked the portal into an eldritch gate, refined the background, added two
  girly drifter sheets + random multi-sprite spawn, plus a dev-only preview
  harness.
- **Inverted far side** (`6804c7f`, `bb276be`, `58a3868`): controls invert while
  a drifter stands past the seam; a one-time whisper hints at it on first
  crossing; a subtle photo-negative shimmer marks any drifter on the far side.
- **SQLite data layer**: the `PortalRoom` DO now keeps a durable `portal_opens`
  log in its SQLite storage (one row per opening: `day_id`, `opened_at`,
  `present`), initialized in the constructor and written on each portal open.
  First real use of the provisioned SQLite class.
- **README**: wrote the project README (what the game is, the mechanics, the
  stack, local dev, deploy).

## In progress / next up

- _Nothing actively in flight._ See backlog for the next candidates.

## Backlog / ideas

- Surface the `portal_opens` log somewhere diegetic (e.g. "opened N times today")
  or expose a read endpoint for it. The data is now being written; nothing reads
  it yet.
- Persist chat history across DO eviction (currently in-memory, last 10).
- Server-side cosmetics persistence (currently client `localStorage` only).
- Tune full-180 inversion difficulty if playtests show the portal rarely opens
  (knob: `chargeDecayPerTick` in `src/game/config.ts`).
- Decide whether to keep the dev-only preview harness + playwright devDependency
  long-term, or split it out.

## Open questions

- _(Resolved) SQLite first use:_ a daily portal-open log (`portal_opens`:
  `day_id`, `opened_at`, `present`). Shipped. Next open question is whether/how to
  read it back (see backlog).

## Notes

- Data today: `links.json` (daily curated links), `screen-names.json` (name
  generator), client `localStorage` (cosmetics), and the DO's SQLite storage
  (`portal_opens` log). No D1, no KV.
- Tests: `bun test`. Type check: `bunx tsc --noEmit`.
