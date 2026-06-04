import type { ClientWorld } from "./world";
import { ROOM_CONFIG } from "./config";
import { drawPortal } from "./portalfx";

export function drawPlaceholder(ctx: CanvasRenderingContext2D, world: ClientWorld, vw: number, vh: number, tMs: number) {
  const sx = vw / ROOM_CONFIG.arenaWidth;
  const sy = vh / ROOM_CONFIG.arenaHeight;
  ctx.clearRect(0, 0, vw, vh);
  ctx.fillStyle = "#060414";
  ctx.fillRect(0, 0, vw, vh);

  // seam
  ctx.strokeStyle = "#7c5cff";
  ctx.beginPath(); ctx.moveTo(ROOM_CONFIG.seamX * sx, 0); ctx.lineTo(ROOM_CONFIG.seamX * sx, vh); ctx.stroke();

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

  // remote players
  for (const r of world.remotes.values()) {
    ctx.fillStyle = `hsl(${r.cosmetics.hue} 80% 60%)`;
    ctx.fillRect(r.x * sx - 8, r.y * sy - 8, 16, 16);
  }
  // self
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(world.self.x * sx - 8, world.self.y * sy - 8, 16, 16);
}
