// High-fidelity parallax space background.
//
// Deliberately the OPPOSITE fidelity from the pixel-art sprites/gate: this layer
// draws with imageSmoothingEnabled = TRUE, full resolution, smooth gradients, no
// pixelation. Real diffuse nebula gas, parallax star fields, and shaded planet
// bodies sit behind the crisp retro foreground. North star for the project:
// "super high tek high fidelity overlaid with a retro nintendo funk." This is
// the high-fidelity half.
//
// Determinism: star layers and planet placements are generated ONCE in
// createBackground via a seeded mulberry32 PRNG, so nothing swims between frames.
// drawBackground never allocates inside its hot loops.

// --- seeded PRNG -----------------------------------------------------------

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// --- types -----------------------------------------------------------------

interface Star {
  x: number;       // 0..1 of canvas width
  y: number;       // 0..1 of canvas height
  size: number;    // px radius/side
  bright: number;  // base alpha 0..1
  phase: number;   // twinkle phase 0..2pi
}

interface StarLayer {
  stars: Star[];
  drift: number;   // px/ms horizontal parallax speed
  twinkle: boolean;
  color: string;   // "r,g,b"
  css: string;     // precomputed "rgb(r,g,b)" so the hot loop never allocates
}

interface Nebula {
  x: number;       // 0..1 anchor
  y: number;       // 0..1 anchor
  radius: number;  // px base radius
  hue: number;
  sat: number;
  light: number;
  alpha: number;   // peak alpha
  driftX: number;  // px/ms
  driftY: number;
  breathPhase: number;
  breathAmt: number; // radius wobble fraction
}

interface Planet {
  img: HTMLImageElement; // real photographic disk (NASA public-domain)
  x: number;       // 0..1 anchor (kept toward an edge)
  y: number;       // 0..1 anchor
  radius: number;  // px disk radius on screen
  driftX: number;  // px/ms (very slow)
  driftY: number;
  bobAmp: number;  // px vertical bob amplitude (gentle life)
  bobPhase: number;
  bobSpeed: number;// rad/ms
  rimHue: number;  // atmosphere glow hue
}

// Planet images load once and are reused across resizes (createBackground runs
// again on every resize). The disks are drawn clipped to a circle so the black
// corners of full-disk JPEGs never occlude the starfield behind them.
const planetImgCache = new Map<string, HTMLImageElement>();
function getPlanetImg(src: string): HTMLImageElement {
  let img = planetImgCache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    planetImgCache.set(src, img);
  }
  return img;
}

// The planet photos used by createBackground. Exported so main.ts can warm the
// cache during the loading screen (alongside the sprite atlases) instead of
// letting them stream in lazily on the first frame, which caused a visible
// ~1s pop-in.
export const PLANET_SRCS = [
  "/sprites/space/jupiter.jpg",
  "/sprites/space/earth.jpg",
  "/sprites/space/mars.jpg",
] as const;

// Kick off (and await) loading of every planet photo. Resolves once all are
// decoded or errored, so the first painted frame already has them. Errors are
// swallowed: a missing planet should never block startup.
export function preloadPlanets(): Promise<void> {
  return Promise.all(
    PLANET_SRCS.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = getPlanetImg(src);
          if (img.complete && img.naturalWidth > 0) return resolve();
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
    ),
  ).then(() => undefined);
}

export interface BgState {
  layers: StarLayer[];
  nebulae: Nebula[];
  planets: Planet[];
  w: number;
  h: number;
  baseGrad: CanvasGradient | null; // cached deep-space gradient (rebuilt on resize)
}

// --- construction ----------------------------------------------------------

export function createBackground(w: number, h: number): BgState {
  const rng = mulberry32(0x9e3779b9); // fixed seed -> deterministic across resizes

  // Three parallax star layers: far (many, dim, tiny, slow), mid, near (fewer,
  // bright, larger, fast, twinkling). Counts scale gently with canvas area so a
  // big window does not look empty.
  const areaScale = Math.max(0.5, Math.min(2.5, (w * h) / (1280 * 720)));

  const mkLayer = (
    count: number, drift: number, sizeMin: number, sizeMax: number,
    brightMin: number, brightMax: number, twinkle: boolean, color: string,
  ): StarLayer => {
    const stars: Star[] = [];
    const n = Math.round(count * areaScale);
    for (let i = 0; i < n; i++) {
      stars.push({
        x: rng(),
        y: rng(),
        size: sizeMin + rng() * (sizeMax - sizeMin),
        bright: brightMin + rng() * (brightMax - brightMin),
        phase: rng() * Math.PI * 2,
      });
    }
    return { stars, drift, twinkle, color, css: `rgb(${color})` };
  };

  const layers: StarLayer[] = [
    // far: dense dust, dim, sub-pixel, barely drifts, cool white-blue
    mkLayer(160, 0.0015, 0.5, 1.1, 0.18, 0.42, false, "200,220,255"),
    // mid: moderate, medium brightness, warmer white
    mkLayer(90, 0.0045, 0.9, 1.8, 0.35, 0.62, false, "225,235,255"),
    // near: sparse, bright, larger, fastest, twinkles
    mkLayer(46, 0.011, 1.4, 2.8, 0.55, 0.95, true, "255,250,240"),
  ];

  // 2-3 soft nebula clouds. Pushed off-center (the gate owns the middle) and
  // tuned to violet/blue/teal so they read as cool interstellar gas. The first
  // entry is treated as the "nearest" nebula for charge warming.
  const nebulae: Nebula[] = [
    {
      x: 0.26, y: 0.34, radius: Math.max(w, h) * 0.5,
      hue: 268, sat: 70, light: 42, alpha: 0.16,
      driftX: 0.0006, driftY: -0.0003,
      breathPhase: rng() * Math.PI * 2, breathAmt: 0.06,
    },
    {
      x: 0.78, y: 0.66, radius: Math.max(w, h) * 0.46,
      hue: 205, sat: 75, light: 40, alpha: 0.14,
      driftX: -0.0005, driftY: 0.0004,
      breathPhase: rng() * Math.PI * 2, breathAmt: 0.07,
    },
    {
      x: 0.6, y: 0.12, radius: Math.max(w, h) * 0.34,
      hue: 178, sat: 60, light: 38, alpha: 0.09,
      driftX: 0.0004, driftY: 0.0005,
      breathPhase: rng() * Math.PI * 2, breathAmt: 0.08,
    },
  ];

  // Two planets, placed toward the canvas edges so they never crowd the central
  // gate. One large body lower-left, one smaller upper-right. Light comes from
  // roughly the gate's direction so they feel lit by the same scene.
  // Three real planet photos, parked toward the corners so the central gate
  // stays clear. Jupiter is the lower-left showpiece, Earth a mid body
  // upper-right, Mars a small accent lower-right.
  const m = Math.min(w, h);
  const planets: Planet[] = [
    {
      img: getPlanetImg("/sprites/space/jupiter.jpg"),
      x: 0.1, y: 0.8, radius: m * 0.17,
      driftX: 0.00006, driftY: -0.00003,
      bobAmp: m * 0.01, bobPhase: rng() * Math.PI * 2, bobSpeed: 0.00018,
      rimHue: 34,
    },
    {
      img: getPlanetImg("/sprites/space/earth.jpg"),
      x: 0.89, y: 0.17, radius: m * 0.1,
      driftX: -0.00005, driftY: 0.00004,
      bobAmp: m * 0.012, bobPhase: rng() * Math.PI * 2, bobSpeed: 0.00022,
      rimHue: 205,
    },
    {
      img: getPlanetImg("/sprites/space/mars.jpg"),
      x: 0.8, y: 0.84, radius: m * 0.06,
      driftX: 0.00004, driftY: 0.00005,
      bobAmp: m * 0.014, bobPhase: rng() * Math.PI * 2, bobSpeed: 0.00026,
      rimHue: 14,
    },
  ];

  return { layers, nebulae, planets, w, h, baseGrad: null };
}

// --- draw ------------------------------------------------------------------

const TAU = Math.PI * 2;

// Wrap a value into [0, m).
function wrap(v: number, m: number): number {
  const r = v % m;
  return r < 0 ? r + m : r;
}

// Per-element parallax depth: fraction of the camera-focus shift each layer
// follows. Far stars barely move; nebulae and planets move more, so walking
// produces real depth instead of a dead, pinned starfield.
const STAR_PARALLAX = [0.08, 0.16, 0.27];
const NEBULA_PARALLAX = 0.12;
const PLANET_PARALLAX = 0.32;

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BgState,
  w: number,
  h: number,
  tMs: number,
  charge: number,
  parX = 0, // camera-focus parallax shift in screen px (0 when centered/locked)
  parY = 0,
): void {
  const prevSmoothing = ctx.imageSmoothingEnabled;
  ctx.imageSmoothingEnabled = true; // HIGH-FIDELITY layer: smooth gradients

  const c = Math.max(0, Math.min(100, charge)) / 100; // 0..1

  // 1) Deep gradient base: near-black with a subtle blue->violet temperature
  // shift across the canvas so the void is not a flat fill. The gradient only
  // depends on w/h, so cache it and rebuild only when the canvas resizes.
  if (!bg.baseGrad) {
    const base = ctx.createLinearGradient(0, 0, w, h);
    base.addColorStop(0, "#04030a");
    base.addColorStop(0.5, "#060415");
    base.addColorStop(1, "#0a0518");
    bg.baseGrad = base;
  }
  ctx.fillStyle = bg.baseGrad;
  ctx.fillRect(0, 0, w, h);

  // 2) Nebula clouds: large radial gradients, low alpha, slow drift + breathing.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (let i = 0; i < bg.nebulae.length; i++) {
    const n = bg.nebulae[i];
    const breath = 1 + Math.sin(tMs * 0.00012 + n.breathPhase) * n.breathAmt;
    const r = n.radius * breath;
    const nx = wrap(n.x * w + n.driftX * tMs + parX * NEBULA_PARALLAX, w + r * 2) - r;
    // wrap ny the same way nx is wrapped so the linear driftY term cannot grow
    // unbounded and creep a nebula permanently off-screen over a long session.
    const nyBreath = Math.sin(tMs * 0.00007 + n.breathPhase) * h * 0.02;
    const ny = wrap(n.y * h + nyBreath + n.driftY * tMs * 0.3 + parY * NEBULA_PARALLAX, h + r * 2) - r;

    // Charge warms the nearest nebula (index 0) toward a warmer hue and a touch
    // more alpha. Kept barely noticeable.
    const warm = i === 0 ? c : 0;
    const hue = n.hue - warm * 36;            // 268 -> ~232 (toward warmer magenta-blue)
    const sat = n.sat + warm * 8;
    const alpha = n.alpha * (1 + warm * 0.35);

    const g = ctx.createRadialGradient(nx, ny, 0, nx, ny, r);
    g.addColorStop(0, `hsla(${hue},${sat}%,${n.light}%,${alpha})`);
    g.addColorStop(0.45, `hsla(${hue},${sat}%,${n.light * 0.7}%,${alpha * 0.45})`);
    g.addColorStop(1, `hsla(${hue},${sat}%,${n.light}%,0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();

  // 3) Parallax star layers. Drift speeds up slightly with charge. Near layer
  // twinkles per-star. No per-frame allocation in these loops.
  const driftMul = 1 + c * 0.25; // charge nudges drift speed
  for (let li = 0; li < bg.layers.length; li++) {
    const layer = bg.layers[li];
    const shift = layer.drift * tMs * driftMul; // px
    const par = STAR_PARALLAX[li];
    const stars = layer.stars;
    // color is per-layer, not per-star: set fillStyle ONCE here. Only globalAlpha
    // (twinkle) varies per star inside the loop, so the loop never allocates.
    ctx.fillStyle = layer.css;
    const spike = layer.twinkle; // only the near layer gets sparkle arms
    for (let si = 0; si < stars.length; si++) {
      const s = stars[si];
      // snap to whole pixels so points stay crisp instead of smearing across
      // pixel boundaries with anti-aliasing.
      const x = Math.round(wrap(s.x * w + shift + parX * par, w));
      const y = Math.round(wrap(s.y * h + parY * par, h));
      let a = s.bright;
      if (layer.twinkle) {
        a *= 0.55 + 0.45 * Math.sin(tMs * 0.003 + s.phase);
      }
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      const d = Math.max(1, Math.round(s.size)); // crisp 1..3px square core
      ctx.fillRect(x, y, d, d);
      // sparkle: faint single-pixel cross arms on the brightest near stars
      if (spike && d >= 2 && a > 0.6) {
        ctx.globalAlpha = a * 0.4;
        ctx.fillRect(x - 1, y, 1, d);
        ctx.fillRect(x + d, y, 1, d);
        ctx.fillRect(x, y - 1, d, 1);
        ctx.fillRect(x, y + d, d, 1);
      }
    }
  }
  ctx.globalAlpha = 1;

  // 4) Planets: real photographic disks, clipped to a circle (so the black
  // corners of full-disk JPEGs never show), with a gentle bob + an additive
  // atmosphere rim so they sit in the scene rather than feeling pasted on.
  for (let pi = 0; pi < bg.planets.length; pi++) {
    const p = bg.planets[pi];
    const img = p.img;
    if (!img.complete || img.naturalWidth === 0) continue; // not loaded yet
    const r = p.radius;
    const bob = Math.sin(tMs * p.bobSpeed + p.bobPhase) * p.bobAmp;
    const px = wrap(p.x * w + p.driftX * tMs + parX * PLANET_PARALLAX, w + r * 4) - r * 2;
    const py = p.y * h + p.driftY * tMs + parY * PLANET_PARALLAX + bob;

    // the photo, fit into a 2r square and masked to the disk circle
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.clip();
    ctx.drawImage(img, px - r, py - r, r * 2, r * 2);
    ctx.restore();

    // atmosphere rim: a soft additive halo hugging the limb for cohesion glow.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rimG = ctx.createRadialGradient(px, py, r * 0.9, px, py, r * 1.12);
    rimG.addColorStop(0, `hsla(${p.rimHue},85%,72%,0)`);
    rimG.addColorStop(0.6, `hsla(${p.rimHue},85%,72%,0.16)`);
    rimG.addColorStop(1, `hsla(${p.rimHue},85%,80%,0)`);
    ctx.fillStyle = rimG;
    ctx.beginPath();
    ctx.arc(px, py, r * 1.12, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // restore caller's smoothing preference; render.ts will also force false after.
  ctx.imageSmoothingEnabled = prevSmoothing;
}
