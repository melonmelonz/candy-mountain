// Offline art preview harness (not shipped). Renders the scene at several charge
// levels with a spread of drifters — including side-facing ones to verify the
// boxes fix, and every sprite-roster index to check the girly sheets.
import { createWorld } from "./game/world";
import { drawScene } from "./game/render";
import { loadAssets } from "./game/assets";
import { SHEETS } from "./game/assets";
import { tintedSheet, drawDrifter, CELL } from "./game/sprite";
import type { RemotePlayer } from "./game/world";
import type { Facing } from "./game/types";

const grid = document.getElementById("grid")!;

// A zoomed inspector: every roster sprite x every facing, walking, at 2x with a
// mid-tone checker so any cell-bleed ("boxes") around the figure is obvious.
function drawInspector() {
  const facings: Facing[] = ["down", "right", "up", "left"];
  return loadAssets().then((assets) => {
    const scale = 2;
    const cellPx = CELL * scale;
    const cv = document.createElement("canvas");
    cv.width = facings.length * cellPx;
    cv.height = SHEETS.length * cellPx;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    // mid-tone background so faint bleed shows against it (not pure dark)
    for (let y = 0; y < cv.height; y += 16) for (let x = 0; x < cv.width; x += 16) {
      ctx.fillStyle = ((x + y) / 16) % 2 ? "#3a3550" : "#322d48";
      ctx.fillRect(x, y, 16, 16);
    }
    for (let si = 0; si < SHEETS.length; si++) {
      const img = assets.drifters[si];
      const sheet = SHEETS[si].tintable ? tintedSheet(img, 210) : img;
      for (let fi = 0; fi < facings.length; fi++) {
        const px = fi * cellPx + cellPx / 2;
        const py = si * cellPx + cellPx / 2;
        drawDrifter(ctx, sheet, facings[fi], true, px, py, scale, 1234);
      }
    }
    const fig = document.createElement("figure");
    const cap = document.createElement("figcaption");
    cap.textContent = "inspector 2x — rows: " + SHEETS.map((s) => s.src.split("/").pop()).join(" / ") + " — cols: down/right/up/left (walking)";
    fig.appendChild(cv); fig.appendChild(cap); grid.appendChild(fig);
  });
}

function mkRemote(id: string, x: number, y: number, facing: Facing, moving: boolean, sprite: number, hue: number, visorHue: number): RemotePlayer {
  return {
    id, name: id, x, y, tx: x, ty: y, facing, moving, bornAt: -10000,
    cosmetics: { hue, visorHue, flair: "emblem", sprite },
  };
}

(async () => {
  const assets = await loadAssets();
  const charges = [0, 45, 80, 100];
  const tMs = 1234; // a frozen walk phase

  for (const charge of charges) {
    const world = createWorld();
    world.selfId = "self";
    world.charge = charge;
    world.self.x = 360; world.self.y = 470; world.self.facing = "right"; world.self.moving = true;
    world.selfCosmetics = { hue: 210, visorHue: 190, flair: "emblem", sprite: 0 };

    // a spread of facings (esp. left/right) across every roster sprite
    const remotes: RemotePlayer[] = [
      mkRemote("r-left",  900, 470, "left",  true,  0, 30,  300),
      mkRemote("r-down",  500, 250, "down",  false, 1, 0,   330),
      mkRemote("r-up",    780, 250, "up",    true,  2, 0,   200),
      mkRemote("r-right2",260, 250, "right", true,  1, 0,   300),
      mkRemote("r-left2", 1040,250, "left",  true,  2, 0,   200),
    ];
    for (const r of remotes) world.remotes.set(r.id, r);

    const fig = document.createElement("figure");
    const cap = document.createElement("figcaption");
    cap.textContent = `charge ${charge} — sprites: ${SHEETS.map((s) => s.src.split("/").pop()).join(", ")}`;
    const cv = document.createElement("canvas");
    cv.width = 1280; cv.height = 720;
    const ctx = cv.getContext("2d")!;
    ctx.imageSmoothingEnabled = false;
    drawScene(ctx, world, assets, cv.width, cv.height, tMs);
    fig.appendChild(cv); fig.appendChild(cap); grid.appendChild(fig);
  }
  await drawInspector();
  (window as unknown as { __ready: boolean }).__ready = true;
})();
