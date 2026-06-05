import { ROOM_CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Phase boundary constants (single source of truth for guards + normalizers)
// ---------------------------------------------------------------------------
const PHASE_A_END = 0.5;   // p at which Phase A finishes
const PHASE_B_END = 0.85;  // p at which Phase B finishes / Phase C begins

// Phase C sub-split: flare peak/fade runs from 0..PHASE_C_FLARE_END,
// black fill bleeds in starting at PHASE_C_BLACK_START (overlapping the fade).
const PHASE_C_FLARE_END   = 0.5;
const PHASE_C_BLACK_START = 0.45;

// Thinnest visible band height (px) at the boundary between Phase B and C
const MIN_BAND_PX = 2;

/**
 * CRT-collapse redirect cinematic. Drive p from 0..1 over the chosen duration
 * and call this every frame. Navigation is the caller's responsibility at p >= 1.
 *
 * Phase A (p 0..0.5)  - gate blooms at arena center, scene dims
 * Phase B (p 0.5..0.85) - CRT vertical collapse: scanlines + squeeze + RGB shimmer
 * Phase C (p 0.85..1.0) - center line flares, then snap to black
 *
 * @param ctx      Active 2D rendering context
 * @param w        Canvas width in CSS px
 * @param h        Canvas height in CSS px
 * @param p        Progress 0..1
 * @param gateDraw Callback that renders the boosted gate at the arena center
 */
export function drawRedirect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  p: number,
  gateDraw: () => void,
): void {
  ctx.save();

  // Derived per-phase progress (each normalizes its slice to 0..1)
  const pA = Math.min(1, p / PHASE_A_END);
  const pB = p < PHASE_A_END ? 0 : Math.min(1, (p - PHASE_A_END) / (PHASE_B_END - PHASE_A_END));
  const pC = p < PHASE_B_END ? 0 : Math.min(1, (p - PHASE_B_END) / (1 - PHASE_B_END));

  // Arena-center screen coords (same math as render.ts / config)
  const sxScale = w / ROOM_CONFIG.arenaWidth;
  const cx = ROOM_CONFIG.seamX * sxScale;
  const cy = (ROOM_CONFIG.arenaHeight / 2) * (h / ROOM_CONFIG.arenaHeight);

  // maxBar = how tall each black bar can grow before Phase C takes over
  const maxBar = cy - MIN_BAND_PX / 2;

  if (p < PHASE_B_END) drawPhaseA(ctx, w, h, cx, cy, pA, pB, gateDraw);
  if (pB > 0)          drawPhaseB(ctx, w, h, cx, cy, p, pB, maxBar);
  if (pC > 0)          drawPhaseC(ctx, w, h, cx, cy, pC, maxBar);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Private helpers — not exported
// ---------------------------------------------------------------------------

/** Phase A: gate bloom + scene dim. Runs while p < PHASE_B_END. */
function drawPhaseA(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cx: number,
  cy: number,
  pA: number,
  pB: number,
  gateDraw: () => void,
): void {
  // Scene dim: dark vignette overlay that deepens through Phase A/B
  const dimAlpha = pA * 0.55 + pB * 0.25;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = Math.min(1, dimAlpha);
  ctx.fillStyle = "rgba(4,2,18,1)";
  ctx.fillRect(0, 0, w, h);
  ctx.globalAlpha = 1;

  // Gate drawn at full charge (boosted) above the dim
  // imageSmoothingEnabled restored by caller; keep nearest-neighbor for gate
  ctx.imageSmoothingEnabled = false;
  gateDraw();

  // Additive radial bloom: starts as white-cyan core, widens cyan->violet
  const ease = pA * pA;
  const diag = Math.hypot(w, h);
  const bloomR = diag * (0.05 + ease * 1.1);
  const coreAlpha = 0.4 + 0.55 * pA;
  const midAlpha = 0.25 + 0.3 * pA;
  const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, bloomR);
  bloom.addColorStop(0, `rgba(255,255,255,${coreAlpha})`);
  bloom.addColorStop(0.15, `hsla(196,100%,80%,${midAlpha})`);
  bloom.addColorStop(0.5, `hsla(245,95%,70%,${midAlpha * 0.55})`);
  bloom.addColorStop(0.75, `hsla(272,90%,55%,${midAlpha * 0.35})`);
  bloom.addColorStop(1, "hsla(272,90%,30%,0)");
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = bloom;
  ctx.fillRect(0, 0, w, h);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/** Phase B: CRT vertical collapse — scanlines, squeeze bars, center band + chromatic shimmer. */
function drawPhaseB(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  _cx: number,
  cy: number,
  p: number,   // global progress (used for continuous shimmer across cinematic)
  pB: number,
  maxBar: number,
): void {
  // --- scanlines: dark horizontal stripes intensifying through Phase B ---
  const scanAlpha = pB * 0.72;
  if (scanAlpha > 0.01) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = scanAlpha;
    ctx.fillStyle = "rgba(0,0,0,0.85)";
    const step = 3; // every 3rd pixel row is a dark line
    for (let y = 0; y < h; y += step) {
      ctx.fillRect(0, y, w, 1);
    }
    ctx.globalAlpha = 1;
  }

  // --- vertical squeeze: black bars grow from top and bottom ---
  // At pB=1 they meet at cy leaving a thin band visible
  const barH = pB * maxBar;
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, barH);         // top bar
  ctx.fillRect(0, h - barH, w, barH); // bottom bar

  // --- bright center band visible through the squeeze ---
  // A horizontal stripe at cy that brightens and narrows
  const bandH = Math.max(MIN_BAND_PX, (1 - pB) * 40 + MIN_BAND_PX);
  const bandY = cy - bandH / 2;
  const bandAlpha = 0.55 + 0.45 * pB;

  // Main white/cyan center line
  const bandGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  bandGrad.addColorStop(0, `rgba(180,245,255,0)`);
  bandGrad.addColorStop(0.3, `rgba(200,250,255,${bandAlpha})`);
  bandGrad.addColorStop(0.5, `rgba(255,255,255,${bandAlpha})`);
  bandGrad.addColorStop(0.7, `rgba(200,250,255,${bandAlpha})`);
  bandGrad.addColorStop(1, `rgba(180,245,255,0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = bandGrad;
  ctx.fillRect(0, bandY, w, bandH);

  // --- RGB chromatic aberration shimmer on the center band ---
  // NOTE: shimmerPhase uses global p (not pB) intentionally — continuous shimmer
  // across the full cinematic so it doesn't reset at phase boundaries.
  const shimmerPhase = p * Math.PI * 14;
  const offset = (2 + 3 * pB) * Math.abs(Math.sin(shimmerPhase));
  const shimmerAlpha = pB * 0.5;
  drawChromaticSplit(ctx, w, bandY, bandH, shimmerAlpha, offset);

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/** Phase C: full black bars, center-line flare, chromatic shimmer, then snap to black. */
function drawPhaseC(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  _cx: number,
  cy: number,
  pC: number,
  maxBar: number,
): void {
  // Sub-split within Phase C
  const flareT = Math.min(1, pC / PHASE_C_FLARE_END);
  const blackT = pC < PHASE_C_BLACK_START ? 0 : Math.min(1, (pC - PHASE_C_BLACK_START) / (1 - PHASE_C_BLACK_START));

  // Ensure black bars cover everything except the center band
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, w, maxBar);
  ctx.fillRect(0, h - maxBar, w, maxBar);

  // The flaring line: expands from ~2px to ~40px at peak then back to 0
  if (blackT < 1) {
    const flarePeak = Math.sin(flareT * Math.PI); // rises then falls
    const flareH = 2 + flarePeak * 60;
    const flareY = cy - flareH / 2;
    const flareAlpha = 0.7 + 0.3 * flarePeak;

    const flareGrad = ctx.createLinearGradient(0, flareY, 0, flareY + flareH);
    flareGrad.addColorStop(0, "rgba(180,245,255,0)");
    flareGrad.addColorStop(0.25, `rgba(255,255,255,${flareAlpha})`);
    flareGrad.addColorStop(0.5, `rgba(255,255,255,${flareAlpha})`);
    flareGrad.addColorStop(0.75, `rgba(255,255,255,${flareAlpha})`);
    flareGrad.addColorStop(1, "rgba(180,245,255,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = flareGrad;
    ctx.fillRect(0, flareY, w, flareH);

    // RGB shimmer on the flare
    const shimmerAlpha = (1 - blackT) * 0.6 * flarePeak;
    const offset = 4 * flarePeak;
    drawChromaticSplit(ctx, w, flareY, flareH, shimmerAlpha, offset);
  }

  // Final snap to black
  if (blackT > 0) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = blackT;
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, w, h);
    ctx.globalAlpha = 1;
  }

  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

/**
 * Draws the red-left / blue-right chromatic-aberration pair on the center band.
 * Caller must have already set composite to "lighter" (this helper keeps it there).
 *
 * @param ctx          Active 2D rendering context (composite must be "lighter")
 * @param w            Canvas width in CSS px
 * @param bandY        Top y-coordinate of the band/flare stripe
 * @param bandH        Height of the band/flare stripe in px
 * @param shimmerAlpha Opacity of the color channels (skip draw when <= 0.01)
 * @param offset       Horizontal pixel offset (red goes left, blue goes right)
 */
function drawChromaticSplit(
  ctx: CanvasRenderingContext2D,
  w: number,
  bandY: number,
  bandH: number,
  shimmerAlpha: number,
  offset: number,
): void {
  if (shimmerAlpha <= 0.01) return;

  // Red channel offset left
  const redGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  redGrad.addColorStop(0, "rgba(255,0,0,0)");
  redGrad.addColorStop(0.5, `rgba(255,60,60,${shimmerAlpha})`);
  redGrad.addColorStop(1, "rgba(255,0,0,0)");
  ctx.fillStyle = redGrad;
  ctx.fillRect(-offset, bandY, w, bandH);

  // Blue channel offset right
  const blueGrad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  blueGrad.addColorStop(0, "rgba(0,60,255,0)");
  blueGrad.addColorStop(0.5, `rgba(60,80,255,${shimmerAlpha})`);
  blueGrad.addColorStop(1, "rgba(0,60,255,0)");
  ctx.fillStyle = blueGrad;
  ctx.fillRect(offset, bandY, w, bandH);
}
