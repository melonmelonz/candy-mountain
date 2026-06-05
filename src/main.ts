import { createWorld, applyState, interpolateRemotes, stepSelf } from "./game/world";
import { createInput } from "./game/input";
import { drawScene, drawOpenBloom } from "./game/render";
import { loadOrCreateCosmetics } from "./game/cosmetics";
import { loadAssets } from "./game/assets";
import { ROOM_CONFIG } from "./game/config";
import {
  OPEN_LINES, OPEN_SUBS, WHISPERS, eggFor, pick,
  drawTransmission, drawWhisper,
} from "./game/flavor";
import { startAmbience, setCharge, playOpenSwell, playSparkle } from "./game/audio";
import { connect } from "./net";

const app = document.getElementById("app")!;
const canvas = document.createElement("canvas");
app.appendChild(canvas);
const ctx = canvas.getContext("2d")!;
let vw = 0, vh = 0;
// Setting canvas.width resets all context state, so re-disable smoothing here.
// Crisp nearest-neighbor sampling stops the sprite-sheet blit from bleeding
// neighboring cells (the faint "boxes" beside the side-profile walk frames).
function resize() { vw = canvas.width = innerWidth; vh = canvas.height = innerHeight; ctx.imageSmoothingEnabled = false; }
addEventListener("resize", resize); resize();

// Procedural favicon: a tiny azure/violet portal so the tab carries the identity.
function installFavicon() {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grad.addColorStop(0, "#bdefff");
  grad.addColorStop(0.45, "#6a9cff");
  grad.addColorStop(0.8, "#8a3df0");
  grad.addColorStop(1, "#0a0422");
  g.fillStyle = grad;
  g.beginPath(); g.arc(16, 16, 15, 0, Math.PI * 2); g.fill();
  g.strokeStyle = "rgba(190,236,255,0.9)"; g.lineWidth = 2;
  g.beginPath(); g.arc(16, 16, 14, 0, Math.PI * 2); g.stroke();
  let link = document.querySelector<HTMLLinkElement>("link[rel='icon']");
  if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
  link.type = "image/png";
  link.href = c.toDataURL("image/png");
}
installFavicon();

// Diegetic tab title that warms with the portal; only written when it changes.
let lastTitle = "";
function setTitle(charge: number, isOpening: boolean) {
  const t = isOpening ? "the way is open"
    : charge >= 85 ? "candy mountain - almost"
    : charge >= 55 ? "candy mountain - it warms"
    : charge >= 25 ? "candy mountain - it stirs"
    : "candy mountain";
  if (t !== lastTitle) { document.title = t; lastTitle = t; }
}

const world = createWorld();
const input = createInput();
const cosmetics = loadOrCreateCosmetics(localStorage);
world.selfCosmetics = cosmetics;

// portal-open cinematic state, with the transmission lines chosen once at fire time
let opening: { url: string; start: number; fired: boolean; line: string; sub: string } | null = null;

// transient whisper shown when charge crosses a threshold band
let whisper: { text: string; start: number } | null = null;
let lastBand: "none" | "low" | "mid" | "high" = "none";
// First-crossing hint: fire a single whisper the first time the self drifter
// steps from the near half into the inverted far half. Plain session state.
let wasFarSide = false;
let crossedOnce = false;

// crystal confetti (easter eggs); each mote drifts and fades
interface Confetti { x: number; y: number; vx: number; vy: number; life: number; hue: number }
let confetti: Confetti[] = [];
function burstConfetti(n: number) {
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 260;
    confetti.push({
      x: vw / 2, y: vh / 2,
      vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - 120,
      life: 1, hue: Math.random() < 0.5 ? 196 : 282,
    });
  }
}

// a one-off egg transmission (typed words / konami) layered like an open line
let egg: { text: string; sub: string; start: number } | null = null;
function showEgg(text: string, sub: string, confettiBurst: boolean) {
  egg = { text, sub, start: performance.now() };
  if (confettiBurst) burstConfetti(120);
  playSparkle();
}

const net = connect({
  onWelcome: (id, spawn) => { world.selfId = id; world.self.x = spawn.x; world.self.y = spawn.y; net.send({ t: "hello", cosmetics }); },
  onState: (msg) => applyState(world, msg.players, msg.spots, msg.charge),
  onOpen: (url) => {
    if (!opening) {
      opening = { url, start: performance.now(), fired: false, line: pick(OPEN_LINES), sub: pick(OPEN_SUBS) };
      playOpenSwell();
    }
  },
  onChat: (msg) => {
    const bubble = { text: msg.text, at: performance.now() };
    if (msg.playerId === world.selfId) world.self.bubble = bubble;
    else { const r = world.remotes.get(msg.playerId); if (r) r.bubble = bubble; }
  },
});

// --- diegetic chat: press Enter to "speak"; words form above your drifter ---
let typing = false;
let draft = "";
const CHAT_MAX = 120;

// --- input-driven flair: ambience needs a user gesture; eggs read the key stream ---
const KONAMI = "uuddlrlrba";
let keySeq = "";
function onFirstGesture() { startAmbience(); }
addEventListener("pointerdown", onFirstGesture, { once: true });
addEventListener("keydown", (e: KeyboardEvent) => {
  startAmbience();

  // while composing, the keyboard belongs to the chat draft
  if (typing) {
    if (e.key === "Enter") {
      const text = draft.trim();
      typing = false; input.setPaused(false); draft = "";
      if (text) { net.send({ t: "chat", text }); world.self.bubble = { text, at: performance.now() }; }
      else world.self.bubble = undefined;
      e.preventDefault(); return;
    }
    if (e.key === "Escape") { typing = false; input.setPaused(false); draft = ""; world.self.bubble = undefined; e.preventDefault(); return; }
    if (e.key === "Backspace") { draft = draft.slice(0, -1); e.preventDefault(); return; }
    if (e.key.length === 1 && draft.length < CHAT_MAX) draft += e.key;
    e.preventDefault(); return;
  }

  // Enter (when idle) opens speak mode and halts movement
  if (e.key === "Enter") { typing = true; input.setPaused(true); draft = ""; e.preventDefault(); return; }

  // build a rolling lowercase sequence for egg detection
  const arrow: Record<string, string> = { ArrowUp: "u", ArrowDown: "d", ArrowLeft: "l", ArrowRight: "r" };
  const ch = arrow[e.key] ?? (e.key.length === 1 ? e.key.toLowerCase() : "");
  if (!ch) return;
  keySeq = (keySeq + ch).slice(-32);
  if (keySeq.endsWith(KONAMI)) {
    showEgg("OK, FINE. HERE'S YOUR CANDY.", "(it is not candy)", true);
    keySeq = "";
    return;
  }
  const found = eggFor(keySeq);
  if (found) { showEgg(found.text, found.sub ?? "", !!found.confetti); keySeq = ""; }
});

function bandFor(charge: number): "none" | "low" | "mid" | "high" {
  if (charge >= 85) return "high";
  if (charge >= 55) return "mid";
  if (charge >= 25) return "low";
  return "none";
}

async function start() {
  const assets = await loadAssets();
  let last = performance.now();
  let lastSent = 0;
  function frame(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    stepSelf(world, input.state, dt);
    interpolateRemotes(world);
    if (now - lastSent > 66) { // ~15 Hz
      lastSent = now;
      net.send({ t: "move", x: world.self.x, y: world.self.y, facing: world.self.facing, moving: world.self.moving });
    }

    setCharge(world.charge);
    setTitle(world.charge, !!opening);

    // live draft floats above your own drifter as you type
    if (typing) world.self.bubble = { text: draft + "\u258c", at: now };

    // whisper on threshold crossings; only when climbing into a higher band
    const band = bandFor(world.charge);
    if (band !== lastBand && band !== "none") {
      const order = { none: 0, low: 1, mid: 2, high: 3 };
      if (order[band] > order[lastBand]) whisper = { text: pick(WHISPERS[band]), start: now };
    }
    lastBand = band;

    // first-crossing hint for the inverted far side
    const farSide = world.self.x > ROOM_CONFIG.seamX;
    if (farSide && !wasFarSide && !crossedOnce) {
      crossedOnce = true;
      whisper = { text: "past the seam, the world turns against you", start: now };
    }
    wasFarSide = farSide;

    drawScene(ctx, world, assets, vw, vh, now);

    // whisper envelope: fade in 0.4s, hold, fade out by 3.5s
    if (whisper) {
      const age = (now - whisper.start) / 1000;
      const a = age < 0.4 ? age / 0.4 : age > 3 ? Math.max(0, 1 - (age - 3) / 0.5) : 1;
      drawWhisper(ctx, vw, vh, whisper.text, a);
      if (age > 3.6) whisper = null;
    }

    // confetti (easter-egg sparkle), simple gravity + fade
    if (confetti.length) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (const c of confetti) {
        c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 380 * dt; c.life -= dt * 0.6;
        if (c.life <= 0) continue;
        ctx.globalAlpha = Math.max(0, c.life);
        ctx.fillStyle = `hsl(${c.hue} 90% 70%)`;
        ctx.fillRect(c.x - 2, c.y - 2, 4, 4);
      }
      ctx.restore();
      confetti = confetti.filter((c) => c.life > 0 && c.y < vh + 40);
    }

    // standalone egg transmission (typed words / konami), ~2.4s on screen
    if (egg) {
      const age = (now - egg.start) / 1000;
      const a = age < 0.25 ? age / 0.25 : age > 1.8 ? Math.max(0, 1 - (age - 1.8) / 0.6) : 1;
      drawTransmission(ctx, vw, vh, egg.text, egg.sub, a, now);
      if (age > 2.4) egg = null;
    }

    // portal-open cinematic: bloom -> transmission -> white engulf -> navigate
    if (opening) {
      const k = Math.min(1, (now - opening.start) / 1800);
      drawOpenBloom(ctx, vw, vh, k);
      // transmission visible through the middle of the bloom
      const ta = k < 0.2 ? k / 0.2 : k > 0.8 ? Math.max(0, 1 - (k - 0.8) / 0.2) : 1;
      drawTransmission(ctx, vw, vh, opening.line, opening.sub, ta, now);
      // final white engulf rides the back half
      const white = Math.max(0, (k - 0.6) / 0.4);
      if (white > 0) {
        ctx.save();
        ctx.globalAlpha = white;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, vw, vh);
        ctx.restore();
      }
      if (k >= 1 && !opening.fired) { opening.fired = true; location.href = opening.url; }
    }

    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start();
