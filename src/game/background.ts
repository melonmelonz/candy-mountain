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
  hue: number;
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
    {
      x: 0.13, y: 0.74, radius: Math.min(w, h) * 0.16,
      hue: 24, driftX: 0.00008, driftY: -0.00004,
      lightAngle: -0.5, // up-right toward center
    },
    {
      x: 0.9, y: 0.2, radius: Math.min(w, h) * 0.085,
      hue: 210, driftX: -0.00006, driftY: 0.00005,
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

export function drawBackground(
  ctx: CanvasRenderingContext2D,
  bg: BgState,
  w: number,
  h: number,
  tMs: number,
  charge: number,
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
    const nx = wrap(n.x * w + n.driftX * tMs, w + r * 2) - r;
    // wrap ny the same way nx is wrapped so the linear driftY term cannot grow
    // unbounded and creep a nebula permanently off-screen over a long session.
    const nyBreath = Math.sin(tMs * 0.00007 + n.breathPhase) * h * 0.02;
    const ny = wrap(n.y * h + nyBreath + n.driftY * tMs * 0.3, h + r * 2) - r;

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
    const stars = layer.stars;
    // color is per-layer, not per-star: set fillStyle ONCE here. Only globalAlpha
    // (twinkle) varies per star inside the loop, so the loop never allocates.
    ctx.fillStyle = layer.css;
    for (let si = 0; si < stars.length; si++) {
      const s = stars[si];
      const x = wrap(s.x * w + shift, w);
      const y = s.y * h;
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

  // 4) Planets: radial body shading + atmosphere rim on the lit edge + a
  // terminator (dark curved shadow on the far edge). Smooth gradients only.
  for (let pi = 0; pi < bg.planets.length; pi++) {
    const p = bg.planets[pi];
    const px = wrap(p.x * w + p.driftX * tMs, w + p.radius * 4) - p.radius * 2;
    const py = p.y * h + p.driftY * tMs;
    const r = p.radius;
    const lx = Math.cos(p.lightAngle);
    const ly = Math.sin(p.lightAngle);

    // body shading: light offset toward the lit side, falling to a dark base
    const bodyG = ctx.createRadialGradient(
      px + lx * r * 0.45, py + ly * r * 0.45, r * 0.1,
      px, py, r,
    );
    bodyG.addColorStop(0, `hsl(${p.hue},55%,58%)`);
    bodyG.addColorStop(0.55, `hsl(${p.hue},50%,34%)`);
    bodyG.addColorStop(1, `hsl(${p.hue},45%,12%)`);
    ctx.fillStyle = bodyG;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, TAU);
    ctx.fill();

    // terminator shadow: a dark gradient pulled from the far (unlit) edge across
    // the body so the night side reads as a curved shadow.
    const termG = ctx.createRadialGradient(
      px - lx * r * 1.15, py - ly * r * 1.15, r * 0.2,
      px - lx * r * 0.3, py - ly * r * 0.3, r * 1.6,
    );
    termG.addColorStop(0, "rgba(2,2,8,0.85)");
    termG.addColorStop(0.5, "rgba(2,2,8,0.35)");
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
    rimG.addColorStop(0.7, `hsla(${p.hue + 12},85%,72%,0.18)`);
    rimG.addColorStop(1, `hsla(${p.hue + 12},85%,78%,0)`);
    ctx.fillStyle = rimG;
    // bias the rim toward the lit side with a clipped wider circle
    ctx.beginPath();
    ctx.arc(px + lx * r * 0.12, py + ly * r * 0.12, r * 1.06, 0, TAU);
    ctx.fill();
    ctx.restore();
  }

  // restore caller's smoothing preference; render.ts will also force false after.
  ctx.imageSmoothingEnabled = prevSmoothing;
}
