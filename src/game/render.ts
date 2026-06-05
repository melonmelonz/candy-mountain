import type { ClientWorld } from "./world";
import type { Assets } from "./assets";
import { SHEETS } from "./assets";
import type { Cosmetics, Facing } from "./types";
import { ROOM_CONFIG } from "./config";
import { drawPortal } from "./portalfx";
import { tintedSheet, drawDrifter } from "./sprite";

// Resolve the drawable sheet for a drifter: pick its roster sheet by sprite
// index (wrapped defensively), hue-tinting only the sheets marked tintable.
function sheetFor(assets: Assets, c: Cosmetics): CanvasImageSource {
  const n = SHEETS.length;
  const idx = ((c.sprite % n) + n) % n;
  const img = assets.drifters[idx];
  return SHEETS[idx].tintable ? tintedSheet(img, c.hue) : img;
}

const DRIFTER_SCALE = 0.6; // 88px cell -> ~53px on screen at 1x

// Respect the OS "reduce motion" setting for the most movement-heavy effects
// (hover bob, drifting motes). Tracked live so toggling it takes effect at once.
let reduceMotion = false;
if (typeof matchMedia !== "undefined") {
  const mq = matchMedia("(prefers-reduced-motion: reduce)");
  reduceMotion = mq.matches;
  mq.addEventListener?.("change", (ev) => { reduceMotion = ev.matches; });
}

// Stable per-player phase so hover bobs are desynced between drifters.
function phaseOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000 * Math.PI * 2;
}

// Gentle vertical hover; crystalline drifters never quite touch the ground.
function hoverOffset(tMs: number, phase: number, moving: boolean, sx: number): number {
  if (reduceMotion) return 0;
  const amp = moving ? 1.4 : 2.8;
  const period = moving ? 220 : 900;
  return Math.sin(tMs / period + phase) * amp * sx;
}

// Drifters near the gate catch its light: a soft additive halo that grows with
// proximity and with portal charge. cx/cy/rPortal are the portal's screen geometry.
function drawPortalKiss(ctx: CanvasRenderingContext2D, px: number, py: number, cx: number, cy: number, rPortal: number, scale: number, e: number) {
  const reach = rPortal * 2.2;
  const d = Math.hypot(px - cx, py - cy);
  if (d >= reach) return;
  const k = (1 - d / reach) * (0.35 + 0.65 * e);
  if (k <= 0.01) return;
  const r = 34 * scale;
  const g = ctx.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, `hsla(200,100%,75%,${0.5 * k})`);
  g.addColorStop(0.6, `hsla(272,90%,62%,${0.28 * k})`);
  g.addColorStop(1, "hsla(272,90%,62%,0)");
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// Soft contact shadow grounds the floating sprite. Shrinks as the drifter rises.
function drawGroundShadow(ctx: CanvasRenderingContext2D, px: number, py: number, scale: number, lift: number) {
  const shrink = 1 - Math.min(0.35, Math.abs(lift) * 0.04);
  ctx.save();
  ctx.globalAlpha = 0.26 * shrink;
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.ellipse(px, py + 26 * scale, 26 * scale * shrink, 8 * scale * shrink, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Deterministic starfield so it does not swim between frames.
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = ((i * 2654435761) >>> 0) / 0xffffffff;
  const g = (((i + 1) * 40503) >>> 0) / 0xffff % 1;
  return { x: r, y: g, tw: (i % 7) / 7 };
});

function drawBackground(ctx: CanvasRenderingContext2D, vw: number, vh: number, tMs: number) {
  // Deep void, pitched to the gate's abyssal palette so the two read as one place.
  ctx.fillStyle = "#050310";
  ctx.fillRect(0, 0, vw, vh);

  // The gate is the only light in the void: a cool nebular glow centered on the
  // portal, so the surrounding dark feels lit *by* the gate rather than decorated.
  const px = ROOM_CONFIG.seamX * (vw / ROOM_CONFIG.arenaWidth);
  const py = (ROOM_CONFIG.arenaHeight / 2) * (vh / ROOM_CONFIG.arenaHeight);
  const neb = ctx.createRadialGradient(px, py, 0, px, py, Math.max(vw, vh) * 0.62);
  neb.addColorStop(0, "rgba(48,40,110,0.26)");
  neb.addColorStop(0.5, "rgba(24,20,66,0.12)");
  neb.addColorStop(1, "rgba(5,3,16,0)");
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, vw, vh);

  // twinkling stars (the original starfield, kept clean and restrained)
  for (const s of STARS) {
    const a = 0.3 + 0.35 * Math.sin(tMs / 700 + s.tw * Math.PI * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = "#cfe8ff";
    ctx.fillRect(s.x * vw, s.y * vh, 1.5, 1.5);
  }
  ctx.globalAlpha = 1;

  // a whisper of vignette at the very edges — focus without an obvious frame
  const vig = ctx.createRadialGradient(px, py, Math.min(vw, vh) * 0.45, px, py, Math.max(vw, vh) * 0.78);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.4)");
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, vw, vh);
}

// Cinematic "portal swallows the screen" bloom. k goes 0..1. The portal blooms
// outward from its arena position. The caller layers transmission text, then the
// final white engulf, on top of this.
export function drawOpenBloom(ctx: CanvasRenderingContext2D, vw: number, vh: number, k: number) {
  const sx = vw / ROOM_CONFIG.arenaWidth;
  const sy = vh / ROOM_CONFIG.arenaHeight;
  const cx = ROOM_CONFIG.seamX * sx, cy = (ROOM_CONFIG.arenaHeight / 2) * sy;
  const diag = Math.hypot(vw, vh);
  const ease = k * k;
  const r = diag * (0.08 + ease * 1.15);
  const white = Math.max(0, (k - 0.6) / 0.4);

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
  g.addColorStop(0, `rgba(255,255,255,${0.65 + 0.35 * white})`);
  g.addColorStop(0.3, `hsla(196,100%,72%,0.6)`);
  g.addColorStop(0.7, `hsla(272,90%,55%,0.5)`);
  g.addColorStop(1, `hsla(272,90%,30%,0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, vw, vh);
  ctx.globalCompositeOperation = "source-over";
}

// Per-cosmetic flair drawn over the sprite at its screen anchor.
function drawFlair(ctx: CanvasRenderingContext2D, c: Cosmetics, px: number, py: number, scale: number, facing: Facing, tMs: number) {
  const half = (44 * scale);
  const tint = `hsl(${c.visorHue} 90% 65%)`;
  switch (c.flair) {
    case "antenna": {
      ctx.strokeStyle = tint; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(px, py - half); ctx.lineTo(px, py - half - 10 * scale); ctx.stroke();
      ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(px, py - half - 10 * scale, 2.5 * scale, 0, Math.PI * 2); ctx.fill();
      break;
    }
    case "backpack": {
      const bx = facing === "right" ? px - half * 0.7 : facing === "left" ? px + half * 0.4 : px - 4 * scale;
      ctx.fillStyle = tint; ctx.globalAlpha = 0.85;
      ctx.fillRect(bx, py - 4 * scale, 8 * scale, 12 * scale);
      ctx.globalAlpha = 1;
      break;
    }
    case "trail": {
      const a = 0.25 + 0.2 * Math.sin(tMs / 300);
      ctx.globalAlpha = a; ctx.fillStyle = tint;
      ctx.beginPath(); ctx.arc(px, py + half * 0.8, 6 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
    case "emblem": {
      ctx.fillStyle = tint; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(px, py, 3 * scale, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      break;
    }
  }
}

const BUBBLE_MS = 6000;       // total time a spoken line lingers
const BUBBLE_FADE_MS = 1000;  // fade window at the end

// A spoken line, rendered in-world above the drifter's head (not a HUD). Shows
// the speaker's auto name and wraps to a few lines, fading out near the end.
function drawSpeechBubble(
  ctx: CanvasRenderingContext2D,
  text: string, name: string,
  px: number, headY: number, scale: number, visorHue: number, tMs: number, at: number,
) {
  const age = tMs - at;
  if (age >= BUBBLE_MS) return;
  const alpha = age > BUBBLE_MS - BUBBLE_FADE_MS ? Math.max(0, (BUBBLE_MS - age) / BUBBLE_FADE_MS) : 1;

  const fontPx = Math.max(12, Math.round(15 * scale));
  const namePx = Math.max(10, Math.round(11 * scale));
  const pad = 8 * scale;
  const maxW = Math.max(150, 200 * scale);

  // word-wrap the body text
  ctx.font = `400 ${fontPx}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const trial = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(trial).width > maxW && cur) { lines.push(cur); cur = w; }
    else cur = trial;
  }
  if (cur) lines.push(cur);

  const lineH = fontPx * 1.25;
  const bodyW = Math.min(maxW, Math.max(...lines.map((l) => ctx.measureText(l).width)));
  ctx.font = `700 ${namePx}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  const nameW = ctx.measureText(name).width;
  const boxW = Math.max(bodyW, nameW) + pad * 2;
  const boxH = namePx + 4 * scale + lines.length * lineH + pad * 2;
  const bx = px - boxW / 2;
  const by = headY - 14 * scale - boxH; // float above the head
  const r = 8 * scale;

  ctx.save();
  ctx.globalAlpha = alpha;

  // rounded panel
  ctx.beginPath();
  ctx.moveTo(bx + r, by);
  ctx.arcTo(bx + boxW, by, bx + boxW, by + boxH, r);
  ctx.arcTo(bx + boxW, by + boxH, bx, by + boxH, r);
  ctx.arcTo(bx, by + boxH, bx, by, r);
  ctx.arcTo(bx, by, bx + boxW, by, r);
  ctx.closePath();
  ctx.fillStyle = "rgba(8,10,28,0.82)";
  ctx.fill();
  ctx.lineWidth = 1.5 * scale;
  ctx.strokeStyle = `hsla(${visorHue},85%,72%,0.7)`;
  ctx.shadowColor = `hsla(${visorHue},90%,65%,0.6)`;
  ctx.shadowBlur = 8 * scale;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // little tail pointing down toward the drifter
  ctx.beginPath();
  ctx.moveTo(px - 6 * scale, by + boxH - 0.5);
  ctx.lineTo(px + 6 * scale, by + boxH - 0.5);
  ctx.lineTo(px, by + boxH + 7 * scale);
  ctx.closePath();
  ctx.fillStyle = "rgba(8,10,28,0.82)";
  ctx.fill();

  // name line + body
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.font = `700 ${namePx}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = `hsla(${visorHue},90%,80%,0.95)`;
  ctx.fillText(name, px, by + pad);
  ctx.font = `400 ${fontPx}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.fillStyle = "rgba(226,232,255,0.96)";
  let ly = by + pad + namePx + 4 * scale;
  for (const l of lines) { ctx.fillText(l, px, ly); ly += lineH; }
  ctx.restore();
}

export function drawScene(ctx: CanvasRenderingContext2D, world: ClientWorld, assets: Assets, vw: number, vh: number, tMs: number) {
  const sx = vw / ROOM_CONFIG.arenaWidth;
  const sy = vh / ROOM_CONFIG.arenaHeight;
  ctx.clearRect(0, 0, vw, vh);
  drawBackground(ctx, vw, vh, tMs);

  // subtle divide marking the split (no UI, just a faint vertical current)
  const cx = ROOM_CONFIG.seamX * sx, cy = (ROOM_CONFIG.arenaHeight / 2) * sy;
  const seam = ctx.createLinearGradient(0, 0, 0, vh);
  seam.addColorStop(0, "hsla(265,90%,60%,0)");
  seam.addColorStop(0.5, "hsla(220,95%,68%,0.16)");
  seam.addColorStop(1, "hsla(265,90%,60%,0)");
  ctx.fillStyle = seam;
  ctx.fillRect(cx - 1, 0, 2, vh);

  // portal brightness reflects charge
  drawPortal(ctx, cx, cy, 72 * sx, world.charge, tMs);

  // spots
  for (const s of world.spots) {
    const base = s.side === "left" ? "#00e0ff" : "#ff8ad1";
    const r = ROOM_CONFIG.spotRadius * sx;
    if (s.covered) {
      const pulse = 0.6 + 0.4 * Math.sin(tMs / 200);
      ctx.globalAlpha = pulse;
      const g = ctx.createRadialGradient(s.pos.x * sx, s.pos.y * sy, 0, s.pos.x * sx, s.pos.y * sy, r);
      g.addColorStop(0, base); g.addColorStop(1, "transparent");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.pos.x * sx, s.pos.y * sy, r, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.globalAlpha = 0.35; ctx.setLineDash([6, 6]); ctx.strokeStyle = base;
      ctx.beginPath(); ctx.arc(s.pos.x * sx, s.pos.y * sy, r, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
    }
  }
  ctx.globalAlpha = 1;

  // energy streams: covered pads pour light into the portal (feeds the ritual)
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const s of world.spots) {
    if (!s.covered) continue;
    const sxp = s.pos.x * sx, syp = s.pos.y * sy;
    const col = s.side === "left" ? "0,224,255" : "255,138,209";
    const segs = 7;
    for (let i = 0; i < segs; i++) {
      const f = ((i / segs) + (tMs / 1400)) % 1; // travels pad(0) -> portal(1)
      const x = sxp + (cx - sxp) * f, y = syp + (cy - syp) * f;
      const a = Math.sin(f * Math.PI) * 0.45;
      const rr = (2 + 3 * (1 - f)) * sx;
      const g = ctx.createRadialGradient(x, y, 0, x, y, rr);
      g.addColorStop(0, `rgba(${col},${a})`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, y, rr, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();

  const scale = sx * DRIFTER_SCALE;
  const rPortal = 72 * sx;
  const e = Math.max(0, Math.min(1, world.charge / 100));

  // remote players
  for (const r of world.remotes.values()) {
    const lift = hoverOffset(tMs, phaseOf(r.id), r.moving, sx);
    const px = r.x * sx, py = r.y * sy;
    const intro = Math.min(1, (tMs - r.bornAt) / 600); // materialize on arrival
    const outro = r.leftAt !== undefined ? Math.min(1, (tMs - r.leftAt) / 600) : 0; // dissolve on leave
    if (outro >= 1) continue; // fully gone, awaiting prune
    const ring = r.cosmetics.visorHue;
    drawGroundShadow(ctx, px, py, scale, lift);
    const sheet = sheetFor(assets, r.cosmetics);
    if (intro < 1) {
      // expanding shimmer ring announces a stranger settling into the void
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - intro) * 0.7;
      ctx.strokeStyle = `hsl(${ring} 90% 70%)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py - lift, 8 * scale + intro * 42 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    } else if (outro > 0) {
      // collapsing ring marks a drifter slipping back out of the void
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = (1 - outro) * 0.7;
      ctx.strokeStyle = `hsl(${ring} 90% 70%)`;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(px, py - lift, 8 * scale + (1 - outro) * 42 * scale, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    ctx.globalAlpha = Math.min(intro, 1 - outro);
    drawPortalKiss(ctx, px, py - lift, cx, cy, rPortal, scale, e);
    drawDrifter(ctx, sheet, r.facing, r.moving, px, py - lift, scale, tMs);
    drawFlair(ctx, r.cosmetics, px, py - lift, scale, r.facing, tMs);
    ctx.globalAlpha = 1;
  }

  // self
  const selfLift = hoverOffset(tMs, 0, world.self.moving, sx);
  const spx = world.self.x * sx, spy = world.self.y * sy;
  drawGroundShadow(ctx, spx, spy, scale, selfLift);
  drawPortalKiss(ctx, spx, spy - selfLift, cx, cy, rPortal, scale, e);
  const selfSheet = sheetFor(assets, world.selfCosmetics);
  drawDrifter(ctx, selfSheet, world.self.facing, world.self.moving, spx, spy - selfLift, scale, tMs);
  drawFlair(ctx, world.selfCosmetics, spx, spy - selfLift, scale, world.self.facing, tMs);

  // speech bubbles, drawn last so they sit above every drifter
  for (const r of world.remotes.values()) {
    if (!r.bubble) continue;
    if (r.leftAt !== undefined && tMs - r.leftAt >= 600) continue;
    const lift = hoverOffset(tMs, phaseOf(r.id), r.moving, sx);
    drawSpeechBubble(ctx, r.bubble.text, r.name, r.x * sx, r.y * sy - lift - 40 * scale, scale, r.cosmetics.visorHue, tMs, r.bubble.at);
  }
  if (world.self.bubble) {
    drawSpeechBubble(ctx, world.self.bubble.text, world.self.name || "you", spx, spy - selfLift - 40 * scale, scale, world.selfCosmetics.visorHue, tMs, world.self.bubble.at);
  }
}
