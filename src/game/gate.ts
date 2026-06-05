import type { Assets } from "./assets";

// Gate ids we've already warned about, so a missing gate logs exactly once.
const warned = new Set<string>();

/**
 * Draw the animated, charge-reactive gate at the arena center. The gate atlas
 * is a single-row strip of `frames` cells; we step through it over time, spin
 * faster as charge rises, and layer an additive violet glow behind it.
 */
export function drawGate(
  ctx: CanvasRenderingContext2D,
  assets: Assets,
  gateId: string,
  cx: number,
  cy: number,
  worldScale: number, // render's sx (vw/arenaWidth); draw size computed internally
  charge: number, // 0..100
  tMs: number,
): void {
  const gate = assets.gates.gates.find((g) => g.id === gateId);
  if (!gate) {
    if (!warned.has(gateId)) {
      warned.add(gateId);
      console.warn(`[gate] no gate def for id: ${gateId}`);
    }
    return;
  }

  const img = assets.images.get(gate.file);
  if (!img) return;

  const e = Math.max(0, Math.min(1, charge / 100));

  // Animation: base 8fps, spinning up to ~13fps at full charge.
  const baseFps = 8;
  const fps = baseFps * (1 + 0.6 * e);
  const frame = Math.floor(tMs / (1000 / fps)) % gate.frames;
  const sx0 = frame * gate.cell;
  const sy0 = 0;
  const sw = gate.cell;
  const sh = gate.cell;

  // Size: strong central presence with a gentle swell as charge rises.
  const GATE_TARGET_PX = 200;
  const swell = 1 + 0.06 * e;
  const dw = GATE_TARGET_PX * worldScale * swell;
  const dh = dw;

  // Additive violet glow behind the gate, growing brighter/wider with charge.
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  const glowR = dw * (0.7 + 0.5 * e);
  const glowA = 0.18 + 0.5 * e;
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowR);
  g.addColorStop(0, `hsla(265,90%,68%,${glowA})`);
  g.addColorStop(0.5, `hsla(220,95%,68%,${glowA * 0.5})`);
  g.addColorStop(1, "hsla(265,90%,60%,0)");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, glowR, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // Draw the current frame nearest-neighbor (pixel art).
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(img, sx0, sy0, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
}
