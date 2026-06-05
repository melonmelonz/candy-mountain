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
  x: number;       // 0..1 anchor (kept toward an edge)
  y: number;       // 0..1 anchor
  radius: number;  // px
  hue: number;     // primary band hue
  hue2: number;    // contrasting band hue (stripes alternate hue..hue2)
  sat: number;     // band saturation
  bands: number;   // latitude band count (gas-giant striping)
  tilt: number;    // band + ring axis tilt (radians)
  ring: number;    // ring outer radius as a fraction of body r; 0 = no ring
  ringInner: number; // ring inner radius as a fraction of body r
  spotLat: number; // storm latitude as a fraction of r (0 = none)
  spotSize: number;// storm radius as a fraction of r (0 = none)
  driftX: number;  // px/ms (very slow)
  driftY: number;
  lightAngle: number; // direction of the light source (radians)
}

export interface BgState {
  layers: StarLayer[];
  nebulae: Nebula[];
  planets: Planet[];
  w: number;
  h: number;
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
  const planets: Planet[] = [
    // Big amber gas giant, lower-left. Banded with a great storm spot and a
    // tilted ring system -- the showpiece body.
    {
      x: 0.12, y: 0.76, radius: Math.min(w, h) * 0.17,
      hue: 32, hue2: 8, sat: 62, bands: 9, tilt: -0.32,
      ring: 1.95, ringInner: 1.28,
      spotLat: 0.28, spotSize: 0.22,
      driftX: 0.00008, driftY: -0.00004,
      lightAngle: -0.5, // up-right toward center
    },
    // Smaller ice giant, upper-right. Cool teal/blue bands, no ring, faint pole
    // storm. Reads as a distant Neptune-like world.
    {
      x: 0.91, y: 0.18, radius: Math.min(w, h) * 0.09,
      hue: 198, hue2: 168, sat: 58, bands: 7, tilt: 0.5,
      ring: 0, ringInner: 0,
      spotLat: -0.34, spotSize: 0.16,
      driftX: -0.00006, driftY: 0.00005,
      lightAngle: Math.PI + 0.7, // down-left toward center
    },
  ];

  return { layers, nebulae, planets, w, h };
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
const STAR_PARALLAX = [0.04, 0.08, 0.13];
const NEBULA_PARALLAX = 0.06;
const PLANET_PARALLAX = 0.18;

// Vertical foreshortening of a ring ellipse (how edge-on we view the rings).
const RING_SQUASH = 0.34;

// Draw one half of a tilted, squashed ring annulus around a planet. The ring is
// split so the body can be painted between the two calls: "back" is the far arc
// (occluded by the planet), "front" is the near arc (drawn over it). Banding in
// the radial gradient suggests Cassini-style divisions.
function drawRing(
  ctx: CanvasRenderingContext2D,
  px: number, py: number, r: number,
  outerFrac: number, innerFrac: number,
  tilt: number, hue: number, sat: number,
  half: "back" | "front",
): void {
  const ro = r * outerFrac;
  const ri = r * innerFrac;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(tilt);
  // half-plane clip in the (rotated, un-squashed) ring frame: back = top, front
  // = bottom. ro tall is plenty since the squashed ellipse is shorter.
  ctx.beginPath();
  if (half === "back") ctx.rect(-ro, -ro, ro * 2, ro);
  else ctx.rect(-ro, 0, ro * 2, ro);
  ctx.clip();
  // work in circle space: a vertical squash turns circular paths/gradients into
  // the foreshortened ring ellipse.
  ctx.scale(1, RING_SQUASH);
  ctx.beginPath();
  ctx.arc(0, 0, ro, 0, TAU);
  ctx.arc(0, 0, ri, 0, TAU);
  ctx.clip("evenodd");
  const g = ctx.createRadialGradient(0, 0, ri, 0, 0, ro);
  g.addColorStop(0.0, `hsla(${hue},${sat - 18}%,60%,0)`);
  g.addColorStop(0.12, `hsla(${hue},${sat - 18}%,62%,0.5)`);
  g.addColorStop(0.38, `hsla(${hue},${sat - 22}%,48%,0.14)`); // division gap
  g.addColorStop(0.52, `hsla(${hue},${sat - 14}%,64%,0.55)`);
  g.addColorStop(0.82, `hsla(${hue},${sat - 18}%,56%,0.3)`);
  g.addColorStop(1.0, `hsla(${hue},${sat - 18}%,56%,0)`);
  ctx.fillStyle = g;
  ctx.fillRect(-ro, -ro, ro * 2, ro * 2);
  ctx.restore();
}

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
  // shift across the canvas so the void is not a flat fill.
  const base = ctx.createLinearGradient(0, 0, w, h);
  base.addColorStop(0, "#04030a");
  base.addColorStop(0.5, "#060415");
  base.addColorStop(1, "#0a0518");
  ctx.fillStyle = base;
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
    for (let si = 0; si < stars.length; si++) {
      const s = stars[si];
      const x = wrap(s.x * w + shift + parX * par, w);
      const y = wrap(s.y * h + parY * par, h);
      let a = s.bright;
      if (layer.twinkle) {
        a *= 0.55 + 0.45 * Math.sin(tMs * 0.003 + s.phase);
      }
      if (a <= 0.01) continue;
      ctx.globalAlpha = a;
      // small bodies: draw as filled circles for soft, non-pixel look
      ctx.beginPath();
      ctx.arc(x, y, s.size, 0, TAU);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;

  // 4) Planets: banded gas-giant bodies (latitude stripes following an axis
  // tilt), a great storm spot, optional tilted ring system, terminator night
  // shadow, and a lit atmosphere rim. Smooth gradients only.
  for (let pi = 0; pi < bg.planets.length; pi++) {
    const p = bg.planets[pi];
    const px = wrap(p.x * w + p.driftX * tMs + parX * PLANET_PARALLAX, w + p.radius * 4) - p.radius * 2;
    const py = p.y * h + p.driftY * tMs + parY * PLANET_PARALLAX;
    const r = p.radius;
    const lx = Math.cos(p.lightAngle);
    const ly = Math.sin(p.lightAngle);

    // back half of the ring (the arc passing behind the body) is drawn first so
    // the planet then occludes it; the front arc is drawn after the body.
    if (p.ring > 0) drawRing(ctx, px, py, r, p.ring, p.ringInner, p.tilt, p.hue, p.sat, "back");

    // --- banded body: stripes drawn in a frame rotated to the planet's tilt ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.clip();
    ctx.translate(px, py);
    ctx.rotate(p.tilt);
    // latitude bands as a vertical linear gradient (perpendicular to the band
    // axis). Alternating hue/light stops read as gas-giant striping.
    const bandG = ctx.createLinearGradient(0, -r, 0, r);
    const steps = p.bands * 2;
    for (let b = 0; b <= steps; b++) {
      const t = b / steps;
      const odd = b % 2 === 0;
      const hue = odd ? p.hue : p.hue2;
      // bands brighten toward the equator, darken toward the poles
      const polar = 1 - Math.abs(t - 0.5) * 0.7;
      const light = (odd ? 52 : 38) * polar;
      bandG.addColorStop(t, `hsl(${hue},${p.sat}%,${light}%)`);
    }
    ctx.fillStyle = bandG;
    ctx.fillRect(-r, -r, r * 2, r * 2);

    // great storm: an elliptical swirl sitting on one band, slightly off the
    // central meridian, squashed to hug the latitude.
    if (p.spotSize > 0) {
      const sxp = r * 0.32;
      const syp = p.spotLat * r;
      const sr = r * p.spotSize;
      const spotG = ctx.createRadialGradient(sxp, syp, 0, sxp, syp, sr);
      spotG.addColorStop(0, `hsl(${p.hue2 - 8},${p.sat + 12}%,62%)`);
      spotG.addColorStop(0.6, `hsla(${p.hue2 - 8},${p.sat + 6}%,46%,0.85)`);
      spotG.addColorStop(1, `hsla(${p.hue2 - 8},${p.sat}%,40%,0)`);
      ctx.save();
      ctx.translate(sxp, syp);
      ctx.scale(1, 0.6);
      ctx.translate(-sxp, -syp);
      ctx.fillStyle = spotG;
      ctx.beginPath();
      ctx.arc(sxp, syp, sr, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.restore();

    // --- spherical lighting on top of the flat bands ---
    // lit-side highlight (additive) so the sphere reads as 3D
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.clip();
    ctx.globalCompositeOperation = "lighter";
    const hiG = ctx.createRadialGradient(
      px + lx * r * 0.5, py + ly * r * 0.5, 0,
      px + lx * r * 0.5, py + ly * r * 0.5, r * 1.1,
    );
    hiG.addColorStop(0, "rgba(255,250,235,0.30)");
    hiG.addColorStop(0.5, "rgba(255,245,225,0.08)");
    hiG.addColorStop(1, "rgba(255,245,225,0)");
    ctx.fillStyle = hiG;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
    ctx.restore();

    // terminator night shadow on the far (unlit) edge
    const termG = ctx.createRadialGradient(
      px - lx * r * 1.15, py - ly * r * 1.15, r * 0.2,
      px - lx * r * 0.3, py - ly * r * 0.3, r * 1.6,
    );
    termG.addColorStop(0, "rgba(2,2,8,0.9)");
    termG.addColorStop(0.5, "rgba(2,2,8,0.4)");
    termG.addColorStop(1, "rgba(2,2,8,0)");
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.clip();
    ctx.fillStyle = termG;
    ctx.fillRect(px - r, py - r, r * 2, r * 2);
    ctx.restore();

    // atmosphere rim: a lighter arc hugging the lit edge, additive for glow.
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const rimG = ctx.createRadialGradient(px, py, r * 0.86, px, py, r * 1.06);
    rimG.addColorStop(0, `hsla(${p.hue + 12},80%,70%,0)`);
    rimG.addColorStop(0.7, `hsla(${p.hue + 12},85%,72%,0.2)`);
    rimG.addColorStop(1, `hsla(${p.hue + 12},85%,78%,0)`);
    ctx.fillStyle = rimG;
    ctx.beginPath();
    ctx.arc(px + lx * r * 0.12, py + ly * r * 0.12, r * 1.06, 0, TAU);
    ctx.fill();
    ctx.restore();

    // front half of the ring, drawn over the body
    if (p.ring > 0) drawRing(ctx, px, py, r, p.ring, p.ringInner, p.tilt, p.hue, p.sat, "front");
  }

  // restore caller's smoothing preference; render.ts will also force false after.
  ctx.imageSmoothingEnabled = prevSmoothing;
}
