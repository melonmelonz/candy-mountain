# Contributing to Candy Mountain

Candy Mountain is a shared space. The one thing it asks of a crowd is cooperation;
the one thing it asks of contributors is a good link.

## Add a daily destination

Every day the portal opens onto a different hand-picked website, drawn from
[`links.json`](./links.json). To add one:

1. Open `links.json`.
2. Append an object to the array:

   ```json
   {
     "url": "https://example.com/something-wonderful",
     "title": "Something Wonderful",
     "blurb": "One short line on why it is worth the trip.",
     "addedBy": "your-name"
   }
   ```

   - `url` and `title` are required.
   - `blurb` and `addedBy` are optional but appreciated.
   - Keep it cool, safe-for-work, and ideally a little strange. Interactive,
     beautiful, or hypnotic sites fit best (think `neal.fun`, generative art,
     live data toys). No ads-first content farms.

3. Open a pull request. Once it merges to `main`, the site redeploys automatically
   and your link enters the daily rotation.

The day's pick is chosen deterministically from the list, so everyone who shows up
on a given day travels to the same place. The order you add links in does not matter.

## Commit messages: ASCII only

The deploy step (Cloudflare wrangler-action) fails on non-ASCII characters. Keep
commit messages and PR titles to plain ASCII: no arrows, em dashes, accented
characters, or emoji. Use `->` instead of an arrow, `~=` instead of an
approximation sign, and so on.

## Running it locally

```bash
bun install
bun run dev        # Vite dev server for the SPA
bun test           # the ritual logic test suite
```

The realtime room is a Cloudflare Durable Object in `portal-room/`. To exercise the
full multiplayer loop locally you also need the Worker running; see the deploy
workflow in `.github/workflows/` for how the Worker and Pages site fit together.

That is the whole job. Add a good link, keep the message ASCII, open a PR.
There is, as promised, no candy.
