import { test, expect } from "bun:test";
import { ROOM_CONFIG } from "../src/game/config";
import { createCamera, updateCamera, cameraParams } from "../src/game/camera";

test("updateCamera does NOT latch when self is far from the gate", () => {
  const cam = createCamera();
  updateCamera(cam, 100, 100, 16);
  expect(cam.locked).toBe(false);
});

test("updateCamera latches when self is within LOCK_DIST of the gate", () => {
  const cam = createCamera();
  updateCamera(cam, ROOM_CONFIG.seamX, ROOM_CONFIG.arenaHeight / 2, 16);
  expect(cam.locked).toBe(true);
});

test("once locked, t advances toward 1 and never exceeds 1", () => {
  const cam = createCamera();
  updateCamera(cam, ROOM_CONFIG.seamX, ROOM_CONFIG.arenaHeight / 2, 16);
  expect(cam.locked).toBe(true);
  updateCamera(cam, ROOM_CONFIG.seamX, ROOM_CONFIG.arenaHeight / 2, 600);
  const tAfterFirst = cam.t;
  expect(tAfterFirst).toBeGreaterThan(0);
  updateCamera(cam, ROOM_CONFIG.seamX, ROOM_CONFIG.arenaHeight / 2, 2000);
  expect(cam.t).toBeGreaterThan(tAfterFirst);
  expect(cam.t).toBeLessThanOrEqual(1);
  updateCamera(cam, ROOM_CONFIG.seamX, ROOM_CONFIG.arenaHeight / 2, 1_000_000);
  expect(cam.t).toBe(1);
});

test("cameraParams at t=1 is identity-equivalent", () => {
  const cam = createCamera();
  cam.t = 1;
  const p = cameraParams(cam, 1280, 720);
  expect(p.Z).toBe(1);
  expect(p.fsx).toBe(640);
  expect(p.fsy).toBe(360);
});

test("cameraParams at t=0 frames tightly on the player", () => {
  const cam = createCamera();
  updateCamera(cam, 300, 200, 16); // local drifter's arena position
  const p = cameraParams(cam, 1280, 720);
  expect(p.Z).toBeCloseTo(2.5);
  expect(p.fsx).toBeCloseTo(300);
  expect(p.fsy).toBeCloseTo(200);
});

test("the gate is outside the spawn viewport even at a closer-than-legal spawn", () => {
  // Conservative check: arena (361,203) is only ~320 from the gate, nearer than
  // the MIN_PORTAL_DIST=480 spawn floor. If the gate stays out of frame here, it
  // is comfortably out of frame for every real spawn (which are all farther).
  const cam = createCamera();
  updateCamera(cam, 361, 203, 16);
  const vw = 1280, vh = 720;
  const p = cameraParams(cam, vw, vh);
  const gx = ROOM_CONFIG.seamX, gy = ROOM_CONFIG.arenaHeight / 2;
  // Gate position in screen space under the camera transform.
  const screenX = vw / 2 + (gx * (vw / ROOM_CONFIG.arenaWidth) - p.fsx) * p.Z;
  const screenY = vh / 2 + (gy * (vh / ROOM_CONFIG.arenaHeight) - p.fsy) * p.Z;
  const offscreen = screenX < 0 || screenX > vw || screenY < 0 || screenY > vh;
  expect(offscreen).toBe(true);
});
