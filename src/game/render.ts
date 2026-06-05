import type { ClientWorld } from "./world";
import type { Assets } from "./assets";
import type { Cosmetics, Facing } from "./types";
import { ROOM_CONFIG } from "./config";
import { drawPortal } from "./portalfx";
import { tintedSheet, drawDrifter } from "./sprite";

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

// Larger, soft motes that drift slowly across the void.
const MOTES = Array.from({ length: 22 }, (_, i) => {
  const x = ((i * 22695477 + 1) >>> 0) / 0xffffffff;
  const y = ((i * 69069 + 13) >>> 0) / 0xffffffff;
  const sp = 0.004 + (i % 5) * 0.0015;
  const hue = i % 2 ? 272 : 196;
  return { x, y, sp, hue, r: 1.5 + (i % 4) * 0.8 };
});

function drawBackground(ctx: CanvasRenderingContext2D, vw: number, vh: number, tMs: number) {
  ctx.fillStyle = "#060414";
  ctx.fillRect(0, 0, vw, vh);

  // soft nebula glow toward the seam
  const neb = ctx.createRadialGradient(vw / 2, vh / 2, 0, vw / 2, vh / 2, Math.max(vw, vh) * 0.6);
  neb.addColorStop(0, "rgba(70,40,120,0.22)");
  neb.addColorStop(1, "rgba(6,4,20,0)");
  ctx.fillStyle = neb;
  ctx.fillRect(0, 0, vw, vh);

  // twinkling stars
  for (const s of STARS) {
    const a = 0.35 + 0.4 * Math.sin(tMs / 700 + s.tw * Math.PI * 2);
    ctx.globalAlpha = Math.max(0, a);
    ctx.fillStyle = "#cfe8ff";
    ctx.fillRect(s.x * vw, s.y * vh, 1.5, 1.5);
  }

  // drifting glow motes
  ctx.globalCompositeOperation = "lighter";
  const drift = reduceMotion ? 0 : tMs / 1000;
  for (const m of MOTES) {
    const px = ((m.x + drift * m.sp) % 1) * vw;
    const py = ((m.y + drift * m.sp * 0.6) % 1) * vh;
    const a = 0.10 + 0.06 * Math.sin(tMs / 900 + m.x * 10);
    const g = ctx.createRadialGradient(px, py, 0, px, py, m.r * 6);
    g.addColorStop(0, `hsla(${m.hue},90%,70%,${a})`);
    g.addColorStop(1, `hsla(${m.hue},90%,70%,0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, m.r * 6, 0, Math.PI * 2); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  // vignette to focus the eye on the arena center
  const vig = ctx.createRadialGradient(vw / 2, vh / 2, Math.min(vw, vh) * 0.35, vw / 2, vh / 2, Math.max(vw, vh) * 0.7);
  vig.addColorStop(0, "rgba(0,0,0,0)");
  vig.addColorStop(1, "rgba(0,0,0,0.55)");
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
    const sheet = tintedSheet(assets.drifter, r.cosmetics.hue);
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
  const selfSheet = tintedSheet(assets.drifter, world.selfCosmetics.hue);
  drawDrifter(ctx, selfSheet, world.self.facing, world.self.moving, spx, spy - selfLift, scale, tMs);
  drawFlair(ctx, world.selfCosmetics, spx, spy - selfLift, scale, world.self.facing, tMs);
}
