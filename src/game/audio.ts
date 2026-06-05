// Procedural ambient audio. No assets: a low drifting drone pad plus a charge
// shimmer that rises with the portal, and a swell on open. Starts only after a
// user gesture (browsers block audio before that). Deliberately quiet.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let shimmer: GainNode | null = null;
let shimmerOsc: OscillatorNode | null = null;
let started = false;

export function startAmbience() {
  if (started) return;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return;
  started = true;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0;
  master.connect(ctx.destination);
  master.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 4); // gentle fade-in

  // two slightly detuned low drones for a wide, breathing pad
  for (const freq of [55, 55.4, 82.5]) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = 0.5;
    // slow tremolo
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.06 + Math.random() * 0.05;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.25;
    lfo.connect(lfoGain).connect(g.gain);
    osc.connect(g).connect(master);
    osc.start();
    lfo.start();
  }

  // charge shimmer: a high tone whose volume tracks portal charge
  shimmerOsc = ctx.createOscillator();
  shimmerOsc.type = "triangle";
  shimmerOsc.frequency.value = 660;
  shimmer = ctx.createGain();
  shimmer.gain.value = 0;
  shimmerOsc.connect(shimmer).connect(master);
  shimmerOsc.start();
}

// Call each frame with charge 0..100.
export function setCharge(charge: number) {
  if (!ctx || !shimmer || !shimmerOsc) return;
  const e = Math.max(0, Math.min(1, charge / 100));
  shimmer.gain.setTargetAtTime(e * 0.04, ctx.currentTime, 0.3);
  shimmerOsc.frequency.setTargetAtTime(520 + e * 480, ctx.currentTime, 0.4);
}

// Rising swell when the portal fires.
export function playOpenSwell() {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  osc.type = "sawtooth";
  const g = ctx.createGain();
  g.gain.value = 0;
  osc.connect(g).connect(master);
  const t = ctx.currentTime;
  osc.frequency.setValueAtTime(220, t);
  osc.frequency.exponentialRampToValueAtTime(1320, t + 1.1);
  g.gain.linearRampToValueAtTime(0.12, t + 0.6);
  g.gain.linearRampToValueAtTime(0, t + 1.4);
  osc.start(t);
  osc.stop(t + 1.5);
}

// A small bright sparkle for easter eggs.
export function playSparkle() {
  if (!ctx || !master) return;
  const t = ctx.currentTime;
  [880, 1320, 1760].forEach((f, i) => {
    const osc = ctx!.createOscillator();
    osc.type = "sine";
    const g = ctx!.createGain();
    g.gain.value = 0;
    osc.connect(g).connect(master!);
    osc.frequency.value = f;
    const s = t + i * 0.07;
    g.gain.linearRampToValueAtTime(0.08, s + 0.02);
    g.gain.linearRampToValueAtTime(0, s + 0.25);
    osc.start(s);
    osc.stop(s + 0.3);
  });
}
