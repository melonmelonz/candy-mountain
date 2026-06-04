// Deterministic depth particles for the void interior (stable across frames).
const STAR_N = 90;
const PSTARS = Array.from({ length: STAR_N }, (_, i) => {
  const a = ((i * 2654435761) >>> 0) / 0xffffffff * Math.PI * 2;
  const z = ((i * 40503 + 7) >>> 0) / 0xffff % 1;
  const near = i % 5 === 0;
  return { a, z, near };
});

// A liquid "End gate": deep parallax void, swirling azure/violet currents,
// rippling liquid bands, a charge-reactive hot core, and a glowing rim.
// All interior layers are clipped to the portal disc; brightness == charge.
export function drawPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, charge: number, tMs: number) {
  const e = Math.max(0, Math.min(1, charge / 100)); // energy 0..1
  const t = tMs / 1000;

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // 1. deep void base
  ctx.fillStyle = "#0a0422";
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // 2. parallax depth particles receding toward the center
  for (let i = 0; i < STAR_N; i++) {
    const s = PSTARS[i];
    const dz = (s.z + t * 0.05 * (0.6 + e)) % 1;
    const depth = 1 - dz;
    const dist = radius * (0.04 + dz * 0.96);
    const px = cx + Math.cos(s.a) * dist;
    const py = cy + Math.sin(s.a) * dist;
    const sz = 0.4 + depth * (s.near ? 2.4 : 1.4);
    ctx.globalAlpha = (0.15 + depth * 0.7) * (0.55 + 0.45 * e);
    ctx.fillStyle = depth > 0.6 ? "#d6ecff" : "#9b6bff";
    ctx.fillRect(px - sz / 2, py - sz / 2, sz, sz);
  }
  ctx.globalAlpha = 1;

  // 3. swirling azure/violet currents (rotating conic wash)
  const conic = ctx.createConicGradient(t * (0.35 + e * 1.1), cx, cy);
  conic.addColorStop(0.00, `hsla(265,90%,${30 + e * 25}%,0)`);
  conic.addColorStop(0.22, `hsla(282,90%,${46 + e * 24}%,${0.22 + e * 0.4})`);
  conic.addColorStop(0.42, `hsla(196,100%,${52 + e * 28}%,${0.28 + e * 0.42})`);
  conic.addColorStop(0.62, `hsla(265,90%,${40 + e * 24}%,${0.18 + e * 0.4})`);
  conic.addColorStop(0.82, `hsla(196,100%,${54 + e * 24}%,${0.28 + e * 0.42})`);
  conic.addColorStop(1.00, `hsla(265,90%,${30 + e * 25}%,0)`);
  ctx.globalCompositeOperation = "lighter";
  ctx.fillStyle = conic;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // 4. rippling liquid bands (sine-displaced concentric loops)
  const bands = 5 + Math.floor(e * 4);
  ctx.lineWidth = 1.2 + e * 2;
  for (let b = 0; b < bands; b++) {
    const fr = b / bands;
    ctx.beginPath();
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      const wob = Math.sin(a * 3 + t * 2 + b) * (radius * 0.045)
        + Math.sin(a * 5 - t * 1.5 + b * 0.7) * (radius * 0.02);
      const rr = radius * (0.18 + fr * 0.8) + wob;
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.strokeStyle = `hsla(${205 - fr * 35}, 100%, ${60 + e * 20}%, ${0.07 + e * 0.2})`;
    ctx.stroke();
  }

  // 5. hot core, brightening toward white as it charges
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  core.addColorStop(0.0, `hsla(190,100%,${70 + e * 25}%,${0.32 + e * 0.6})`);
  core.addColorStop(0.5, `hsla(265,90%,${45 + e * 20}%,${0.12 + e * 0.35})`);
  core.addColorStop(1.0, "hsla(265,90%,20%,0)");
  ctx.fillStyle = core;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
  ctx.globalCompositeOperation = "source-over";

  ctx.restore(); // drop clip

  // 6. event-horizon rim + bloom
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2 + e * 4;
  ctx.strokeStyle = `hsla(${200 - e * 30}, 100%, ${66 + e * 20}%, ${0.5 + e * 0.5})`;
  ctx.shadowBlur = 10 + e * 30;
  ctx.shadowColor = `hsla(282,100%,70%,${0.5 + e * 0.5})`;
  ctx.stroke();
  ctx.restore();

  // 7. outer glow halo (grows with charge)
  if (e > 0.001) {
    const ro = radius * (1.35 + e * 0.9);
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.85, cx, cy, ro);
    halo.addColorStop(0, `hsla(272,90%,62%,${0.18 * e})`);
    halo.addColorStop(1, "hsla(272,90%,62%,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, ro, 0, Math.PI * 2);
    ctx.fill();
  }
}
