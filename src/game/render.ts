import type { ClientWorld } from "./world";
import type { Assets } from "./assets";
import type { Cosmetics, Facing } from "./types";
import { ROOM_CONFIG } from "./config";
import { drawPortal } from "./portalfx";
import { tintedSheet, drawDrifter } from "./sprite";

const DRIFTER_SCALE = 0.7; // 68px cell -> ~48px on screen at 1x

// Deterministic starfield so it does not swim between frames.
const STARS = Array.from({ length: 140 }, (_, i) => {
  const r = ((i * 2654435761) >>> 0) / 0xffffffff;
  const g = (((i + 1) * 40503) >>> 0) / 0xffff % 1;
  return { x: r, y: g, tw: (i % 7) / 7 };
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
  ctx.globalAlpha = 1;
}

// Per-cosmetic flair drawn over the sprite at its screen anchor.
function drawFlair(ctx: CanvasRenderingContext2D, c: Cosmetics, px: number, py: number, scale: number, facing: Facing, tMs: number) {
  const half = (34 * scale);
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

  // portal brightness reflects charge
  const cx = ROOM_CONFIG.seamX * sx, cy = (ROOM_CONFIG.arenaHeight / 2) * sy;
  drawPortal(ctx, cx, cy, 48 * sx, world.charge, tMs);

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

  const scale = sx * DRIFTER_SCALE;

  // remote players
  for (const r of world.remotes.values()) {
    const px = r.x * sx, py = r.y * sy;
    const sheet = tintedSheet(assets.drifter, r.cosmetics.hue);
    drawDrifter(ctx, sheet, r.facing, r.moving, px, py, scale, tMs);
    drawFlair(ctx, r.cosmetics, px, py, scale, r.facing, tMs);
  }

  // self
  const spx = world.self.x * sx, spy = world.self.y * sy;
  const selfSheet = tintedSheet(assets.drifter, world.selfCosmetics.hue);
  drawDrifter(ctx, selfSheet, world.self.facing, world.self.moving, spx, spy, scale, tMs);
  drawFlair(ctx, world.selfCosmetics, spx, spy, scale, world.self.facing, tMs);
}
