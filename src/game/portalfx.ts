export function drawPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, charge: number, tMs: number) {
  const energy = charge / 100;
  const rings = 3 + Math.floor(energy * 5);
  for (let i = 0; i < rings; i++) {
    const f = i / rings;
    const r = radius * (0.4 + f * 0.9);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${260 - energy * 80}, 90%, ${55 + energy * 20}%, ${0.15 + energy * 0.5})`;
    ctx.lineWidth = 1 + energy * 3;
    ctx.stroke();
  }
  // hot core
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, `hsla(190, 100%, ${60 + energy * 30}%, ${0.4 + energy * 0.6})`);
  grad.addColorStop(1, "hsla(260, 90%, 30%, 0)");
  ctx.fillStyle = grad;
  ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
}
