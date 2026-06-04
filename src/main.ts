import { createWorld, applyState, interpolateRemotes, stepSelf } from "./game/world";
import { createInput } from "./game/input";
import { drawScene, drawOpenTransition } from "./game/render";
import { loadOrCreateCosmetics } from "./game/cosmetics";
import { loadAssets } from "./game/assets";
import { connect } from "./net";

const app = document.getElementById("app")!;
const canvas = document.createElement("canvas");
app.appendChild(canvas);
const ctx = canvas.getContext("2d")!;
let vw = 0, vh = 0;
function resize() { vw = canvas.width = innerWidth; vh = canvas.height = innerHeight; }
addEventListener("resize", resize); resize();

const world = createWorld();
const input = createInput();
const cosmetics = loadOrCreateCosmetics(localStorage);
world.selfCosmetics = cosmetics;

let opening: { url: string; start: number; fired: boolean } | null = null;

const net = connect({
  onWelcome: (id, spawn) => { world.selfId = id; world.self.x = spawn.x; world.self.y = spawn.y; net.send({ t: "hello", cosmetics }); },
  onState: (msg) => applyState(world, msg.players, msg.spots, msg.charge),
  onOpen: (url) => { if (!opening) opening = { url, start: performance.now(), fired: false }; },
});

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
    drawScene(ctx, world, assets, vw, vh, now);
    if (opening) {
      const k = Math.min(1, (now - opening.start) / 1200);
      drawOpenTransition(ctx, vw, vh, k);
      if (k >= 1 && !opening.fired) { opening.fired = true; location.href = opening.url; }
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
start();
