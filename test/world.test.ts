import { describe, it, expect } from "bun:test";
import { createWorld, applyState, interpolateRemotes, stepSelf } from "../src/game/world";
import { ROOM_CONFIG } from "../src/game/config";
import type { PlayerWire } from "../src/protocol";

const SPEED = 220;

function makePlayer(id: string, x: number, y: number): PlayerWire {
  return { id, name: id, x, y, facing: "down", moving: false, cosmetics: { hue: 0, visorHue: 0, flair: "antenna", sprite: 0 } };
}

describe("stepSelf", () => {
  it("no input keeps position unchanged and sets moving=false", () => {
    const world = createWorld();
    const startX = world.self.x;
    const startY = world.self.y;
    stepSelf(world, { up: false, down: false, left: false, right: false }, 0.1);
    expect(world.self.x).toBe(startX);
    expect(world.self.y).toBe(startY);
    expect(world.self.moving).toBe(false);
  });

  it("moving right increases x by SPEED*dt and sets facing=right", () => {
    const world = createWorld();
    const startX = world.self.x;
    stepSelf(world, { up: false, down: false, left: false, right: true }, 0.1);
    expect(world.self.x).toBeCloseTo(startX + SPEED * 0.1, 5);
    expect(world.self.facing).toBe("right");
  });

  it("moving up sets facing=up", () => {
    const world = createWorld();
    const startY = world.self.y;
    stepSelf(world, { up: true, down: false, left: false, right: false }, 0.1);
    expect(world.self.y).toBeCloseTo(startY - SPEED * 0.1, 5);
    expect(world.self.facing).toBe("up");
  });

  it("diagonal (right+down) normalizes — displacement magnitude equals SPEED*dt not SPEED*dt*sqrt(2)", () => {
    const world = createWorld();
    const startX = world.self.x;
    const startY = world.self.y;
    const dt = 0.1;
    stepSelf(world, { up: false, down: true, left: false, right: true }, dt);
    const dx = world.self.x - startX;
    const dy = world.self.y - startY;
    const dist = Math.hypot(dx, dy);
    expect(dist).toBeCloseTo(SPEED * dt, 5);
  });

  it("clamps to arena bounds when moving right past arenaWidth", () => {
    const world = createWorld();
    world.self.x = 100; // near side: normal controls, so right input clamps to arenaWidth
    stepSelf(world, { up: false, down: false, left: false, right: true }, 10); // large dt
    expect(world.self.x).toBe(ROOM_CONFIG.arenaWidth);
  });

  it("on the far side of the seam, pressing right moves -x and faces left", () => {
    const world = createWorld();
    world.self.x = ROOM_CONFIG.seamX + 100; // far side
    const startX = world.self.x;
    stepSelf(world, { up: false, down: false, left: false, right: true }, 0.1);
    expect(world.self.x).toBeCloseTo(startX - SPEED * 0.1, 5);
    expect(world.self.facing).toBe("left");
  });

  it("on the far side of the seam, pressing down moves -y and faces up", () => {
    const world = createWorld();
    world.self.x = ROOM_CONFIG.seamX + 100; // far side
    const startY = world.self.y;
    stepSelf(world, { up: false, down: true, left: false, right: false }, 0.1);
    expect(world.self.y).toBeCloseTo(startY - SPEED * 0.1, 5);
    expect(world.self.facing).toBe("up");
  });

  it("controls are normal exactly at the seam (x === seamX is not inverted)", () => {
    const world = createWorld();
    world.self.x = ROOM_CONFIG.seamX; // exactly on the seam -> normal
    const startX = world.self.x;
    stepSelf(world, { up: false, down: false, left: false, right: true }, 0.1);
    expect(world.self.x).toBeCloseTo(startX + SPEED * 0.1, 5);
    expect(world.self.facing).toBe("right");
  });
});

describe("applyState", () => {
  it("adds a new remote player with tx/ty set to incoming x/y", () => {
    const world = createWorld();
    world.selfId = "self";
    const p = makePlayer("remote1", 100, 200);
    applyState(world, [p], [], 0, "test-gate-id");
    const r = world.remotes.get("remote1");
    expect(r).toBeDefined();
    expect(r!.tx).toBe(100);
    expect(r!.ty).toBe(200);
  });

  it("skips the self player (selfId not added to remotes)", () => {
    const world = createWorld();
    world.selfId = "self";
    const p = makePlayer("self", 100, 200);
    applyState(world, [p], [], 0, "test-gate-id");
    expect(world.remotes.has("self")).toBe(false);
  });

  it("marks vanished remotes for a dissolve, then prunes after the fade", () => {
    const world = createWorld();
    world.selfId = "self";
    const p = makePlayer("remote1", 100, 200);
    applyState(world, [p], [], 0, "test-gate-id");
    expect(world.remotes.has("remote1")).toBe(true);

    // first absence: still present but marked for dissolve
    applyState(world, [], [], 0, "test-gate-id");
    const r = world.remotes.get("remote1");
    expect(r).toBeDefined();
    expect(r!.leftAt).toBeGreaterThan(0);

    // backdate the dissolve so the fade window has elapsed, then prune
    r!.leftAt = performance.now() - 800;
    applyState(world, [], [], 0, "test-gate-id");
    expect(world.remotes.has("remote1")).toBe(false);
  });

  it("cancels a pending dissolve when a remote is seen again", () => {
    const world = createWorld();
    world.selfId = "self";
    const p = makePlayer("remote1", 100, 200);
    applyState(world, [p], [], 0, "test-gate-id");
    applyState(world, [], [], 0, "test-gate-id");
    expect(world.remotes.get("remote1")!.leftAt).toBeGreaterThan(0);
    applyState(world, [p], [], 0, "test-gate-id");
    expect(world.remotes.get("remote1")!.leftAt).toBeUndefined();
  });
});

describe("interpolateRemotes", () => {
  it("moves r.x a fraction (alpha 0.25) toward r.tx", () => {
    const world = createWorld();
    world.selfId = "self";
    const p = makePlayer("remote1", 100, 0);
    applyState(world, [p], [], 0, "test-gate-id");
    // Manually set r.x to 0 so we have x=0, tx=100
    const r = world.remotes.get("remote1")!;
    r.x = 0;
    interpolateRemotes(world, 0.25);
    expect(r.x).toBeCloseTo(25, 5);
  });
});
