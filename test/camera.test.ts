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

test("cameraParams at t=0 is the spawn framing", () => {
  const cam = createCamera();
  const p = cameraParams(cam, 1280, 720);
  expect(p.Z).toBeCloseTo(1.3);
  expect(p.fsx).toBeCloseTo(0.266 * 1280);
});
