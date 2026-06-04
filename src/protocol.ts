import type { Cosmetics, Facing, PlayerId, Spot } from "./game/types";

export interface PlayerWire {
  id: PlayerId;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  cosmetics: Cosmetics;
}

// client -> server
export type ClientMsg =
  | { t: "hello"; cosmetics: Cosmetics }
  | { t: "move"; x: number; y: number; facing: Facing; moving: boolean };

// server -> client
export type ServerMsg =
  | { t: "welcome"; id: PlayerId; spawn: { x: number; y: number }; dayId: string }
  | { t: "state"; players: PlayerWire[]; spots: Spot[]; charge: number }
  | { t: "open"; url: string; title: string };

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function decode<T>(raw: string): T {
  return JSON.parse(raw) as T;
}
