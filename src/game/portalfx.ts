// An eldritch gate, not a lava lamp. Built on the original's restraint:
// a recessed abyssal well, a thin iris of aperture rings, a cold event-horizon
// rim, and a pupil that stays dead-black until charge ignites it. Darkness is
// the default state; light is earned. All interior layers clip to the disc and
// brightness tracks charge (e).
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

// A few arcane rim ticks placed at fixed angles — a gate, not a clock face.
const RIM_TICKS = 9;

export function drawPortal(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number, charge: number, tMs: number) {
  const e = clamp01(charge / 100);
  const t = tMs / 1000;
  const breath = 0.5 + 0.5 * Math.sin(t * 0.6); // slow, dread-paced pulse

  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  // 1. abyssal well: dark at the rim, darker toward the throat — a bowl that
  //    recedes away from the viewer. This reads as depth, not a flat disc.
  const well = ctx.createRadialGradient(cx, cy, radius * 0.95, cx, cy, 0);
  well.addColorStop(0.0, "#12082e");
  well.addColorStop(0.5, "#0a0420");
  well.addColorStop(1.0, "#030109");
  ctx.fillStyle = well;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

  // 2. a faint cold wash that only the charge brings up from the depths
  if (e > 0.001) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
    glow.addColorStop(0.0, `hsla(196,100%,60%,${0.18 * e})`);
    glow.addColorStop(0.45, `hsla(258,85%,48%,${0.14 * e})`);
    glow.addColorStop(1.0, "hsla(258,85%,30%,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = glow;
    ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
    ctx.globalCompositeOperation = "source-over";
  }

  // 3. iris: a small set of clean concentric aperture rings that breathe inward.
  //    These descend from the original portal's rings, but disciplined — thin,
  //    cold, and few. The aperture widens (rings brighten) as the gate charges.
  const ringCount = 5;
  ctx.lineWidth = 1;
  for (let i = 0; i < ringCount; i++) {
    const f = (i + 1) / (ringCount + 1);
    const rr = radius * (0.18 + f * 0.74) * (0.97 + 0.03 * breath);
    // A visible resting presence (0.10) so the dormant gate still reads as an
    // arcane aperture, brightening as it charges.
    const a = (0.10 + 0.16 * e) * (1 - f * 0.4);
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.strokeStyle = `hsla(${205 - f * 20},90%,${62 + e * 18}%,${a})`;
    ctx.stroke();
  }

  // 4. pupil: a dead-black throat at rest. As charge climbs it ignites into a
  //    cold-hot point — the way beginning to open. The dark core is the dread.
  const pr = radius * (0.30 + 0.05 * breath);
  const pupil = ctx.createRadialGradient(cx, cy, 0, cx, cy, pr);
  if (e < 0.5) {
    // still mostly a void: black throat ringed by the faintest cold edge
    pupil.addColorStop(0.0, "#000005");
    pupil.addColorStop(0.7, "#02010a");
    pupil.addColorStop(1.0, `hsla(220,80%,30%,${0.12 + e * 0.3})`);
    ctx.fillStyle = pupil;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
  } else {
    // ignition: a hot core blooms toward white as it nears full
    const k = (e - 0.5) / 0.5; // 0..1 across the upper half of charge
    pupil.addColorStop(0.0, `hsla(190,100%,${78 + k * 20}%,${0.5 + k * 0.5})`);
    pupil.addColorStop(0.5, `hsla(210,100%,${60 + k * 20}%,${0.3 + k * 0.4})`);
    pupil.addColorStop(1.0, "hsla(258,90%,30%,0)");
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = pupil;
    ctx.beginPath(); ctx.arc(cx, cy, pr, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = "source-over";
  }

  ctx.restore(); // drop clip

  // 5. event-horizon rim: a crisp dark lip with a cold inner light. It sharpens
  //    and brightens with charge — the membrane between here and there.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = 2.5 + e * 3;
  ctx.strokeStyle = `hsla(${205 - e * 20},100%,${58 + e * 22}%,${0.45 + e * 0.5})`;
  ctx.shadowBlur = 8 + e * 26;
  ctx.shadowColor = `hsla(220,100%,65%,${0.4 + e * 0.5})`;
  ctx.stroke();
  ctx.restore();

  // 6. arcane rim ticks: short radial glyph-marks set into the rim, lit only as
  //    the gate wakes. Fixed angles read as deliberate sigils, not motion.
  if (e > 0.05) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = 0; i < RIM_TICKS; i++) {
      const ang = (i / RIM_TICKS) * Math.PI * 2 + t * 0.08;
      const pulse = 0.5 + 0.5 * Math.sin(t * 1.4 + i * 1.7);
      const a = e * (0.2 + 0.4 * pulse);
      const r0 = radius * 0.98, r1 = radius * (1.06 + e * 0.05);
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0);
      ctx.lineTo(cx + Math.cos(ang) * r1, cy + Math.sin(ang) * r1);
      ctx.lineWidth = 1.5 + e;
      ctx.strokeStyle = `hsla(196,100%,72%,${a})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  // 7. outer halo: a quiet bloom that swells with charge, bleeding the gate's
  //    light into the surrounding void.
  if (e > 0.001) {
    const ro = radius * (1.3 + e * 0.95);
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.9, cx, cy, ro);
    halo.addColorStop(0, `hsla(248,90%,60%,${0.16 * e})`);
    halo.addColorStop(0.6, `hsla(258,90%,55%,${0.07 * e})`);
    halo.addColorStop(1, "hsla(258,90%,55%,0)");
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, ro, 0, Math.PI * 2);
    ctx.fill();
  }
}
