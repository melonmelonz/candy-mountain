export type PlayerId = string;
export type Side = "left" | "right";
export type Facing = "up" | "down" | "left" | "right";
export type Flair = "antenna" | "backpack" | "trail" | "emblem";

export interface Vec2 { x: number; y: number; }

export interface Cosmetics {
  hue: number;       // 0..360 suit color
  visorHue: number;  // 0..360 visor tint
  flair: Flair;
}

export interface Player {
  id: PlayerId;
  pos: Vec2;
  facing: Facing;
  moving: boolean;
  cosmetics: Cosmetics;
  lastInputAt: number; // ms epoch of last move/hello
}

export interface Spot {
  id: string;
  side: Side;
  pos: Vec2;
  covered: boolean;
}

export interface RoomState {
  players: Record<PlayerId, Player>;
  spots: Spot[];
  charge: number; // 0..100
  dayId: string;  // e.g. "2026-06-04"
}
