// Diegetic voice of the portal: dramatic transmissions at the open moment and
// faint whispers as the charge climbs. Dry, cosmic, a little Charlie-the-Unicorn.

// Whispers keyed by charge threshold. Picked once per threshold crossing.
export const WHISPERS: Record<"low" | "mid" | "high", string[]> = {
  low: ["it stirs", "something listens", "warmer"],
  mid: ["keep together", "do not drift", "closer"],
  high: ["almost", "hold the line", "it opens"],
};

export interface EggResult { text: string; sub?: string; confetti?: boolean }

// Returns flavor for a recognized typed/keyed sequence, or null.
export function eggFor(seq: string): EggResult | null {
  if (seq.endsWith("candy")) return { text: "THERE IS NO CANDY", sub: "(there was never any candy)" };
  if (seq.endsWith("charlie")) return { text: "SHUN THE NONBELIEVER", sub: "(shuuuunnn)" };
  if (seq.endsWith("hello")) return { text: "OH, HELLO", sub: "(you found the quiet)" };
  return null;
}

export function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Centered glowing transmission. alpha 0..1; gently pulses and rises.
export function drawTransmission(ctx: CanvasRenderingContext2D, vw: number, vh: number, text: string, sub: string, alpha: number, tMs: number) {
  if (alpha <= 0) return;
  const cx = vw / 2, cy = vh / 2;
  const pulse = 1 + 0.03 * Math.sin(tMs / 180);
  const size = Math.max(28, Math.min(72, vw / 16)) * pulse;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${size}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.shadowColor = "hsla(282,100%,70%,0.9)";
  ctx.shadowBlur = 24;
  ctx.fillStyle = "hsla(196,100%,85%,1)";
  ctx.fillText(text, cx, cy - size * 0.2);
  if (sub) {
    ctx.shadowBlur = 10;
    ctx.font = `400 ${size * 0.32}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
    ctx.fillStyle = "hsla(265,80%,82%,0.85)";
    ctx.fillText(sub, cx, cy + size * 0.5);
  }
  ctx.restore();
}

// Small faint whisper near the lower third.
export function drawWhisper(ctx: CanvasRenderingContext2D, vw: number, vh: number, text: string, alpha: number) {
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha * 0.7;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `300 ${Math.max(13, vw / 70)}px "Trebuchet MS", "Segoe UI", system-ui, sans-serif`;
  ctx.shadowColor = "hsla(265,90%,70%,0.8)";
  ctx.shadowBlur = 12;
  ctx.fillStyle = "hsla(265,70%,86%,0.9)";
  ctx.fillText(text, vw / 2, vh * 0.72);
  ctx.restore();
}
