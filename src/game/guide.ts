// A subtle "tinkerbell" wisp that points each drifter toward the gate and
// fades as they arrive. Self only.

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function drawGuide(
  ctx: CanvasRenderingContext2D,
  px: number, py: number,   // self player screen position
  cx: number, cy: number,   // gate (portal) screen position
  scale: number, tMs: number,
): void {
  const d = Math.hypot(cx - px, cy - py);
  if (d === 0) return;
  const ux = (cx - px) / d, uy = (cy - py) / d;

  const FADE_NEAR = 140 * scale; // fully gone
  const FADE_FAR = 360 * scale;  // full strength
  const alpha = clamp((d - FADE_NEAR) / (FADE_FAR - FADE_NEAR), 0, 1);
  if (alpha <= 0) return;

  // main mote: a short offset ahead of the player, with a gentle perpendicular bob
  const offset = 26 * scale;
  const wobble = Math.sin(tMs / 320) * 5 * scale;
  const mx = px + ux * offset - uy * wobble;
  const my = py + uy * offset + ux * wobble;

  ctx.save();
  ctx.globalCompositeOperation = "lighter";

  // soft additive glow
  const rGlow = 7 * scale;
  const g = ctx.createRadialGradient(mx, my, 0, mx, my, rGlow);
  g.addColorStop(0, `rgba(220, 255, 255, ${0.9 * alpha})`);
  g.addColorStop(0.4, `rgba(80, 220, 255, ${0.5 * alpha})`);
  g.addColorStop(1, "rgba(80, 220, 255, 0)");
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(mx, my, rGlow, 0, Math.PI * 2); ctx.fill();

  // bright small white core dot
  ctx.fillStyle = `rgba(255, 255, 255, ${0.95 * alpha})`;
  ctx.beginPath(); ctx.arc(mx, my, 1.6 * scale, 0, Math.PI * 2); ctx.fill();

  // trailing sparkles, lagging behind the mote along -dir
  for (let i = 1; i <= 3; i++) {
    const lag = i * 9 * scale;
    const sx = mx - ux * lag;
    const sy = my - uy * lag;
    const flick = 0.7 + 0.3 * Math.sin(tMs / 320 - i * 0.7);
    const r = (4 - i) * scale;
    const a = alpha * (0.5 - i * 0.12) * flick;
    if (a <= 0) continue;
    ctx.fillStyle = `rgba(160, 240, 255, ${a})`;
    ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}
