import type { ClientWorld } from "./world";
import { ROOM_CONFIG } from "./config";

export function drawPlaceholder(ctx: CanvasRenderingContext2D, world: ClientWorld, vw: number, vh: number) {
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
  ctx.globalAlpha = 0.3 + (world.charge / 100) * 0.7;
  ctx.fillStyle = "#7c5cff";
  ctx.beginPath(); ctx.arc(cx, cy, 40, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;

  // spots
  for (const s of world.spots) {
    ctx.strokeStyle = s.side === "left" ? "#00e0ff" : "#ff8ad1";
    ctx.globalAlpha = s.covered ? 1 : 0.4;
    ctx.beginPath(); ctx.arc(s.pos.x * sx, s.pos.y * sy, ROOM_CONFIG.spotRadius * sx, 0, Math.PI * 2); ctx.stroke();
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
