import type { Cosmetics, Facing, PlayerId, Spot } from "./game/types";

export interface PlayerWire {
  id: PlayerId;
  name: string;
  x: number;
  y: number;
  facing: Facing;
  moving: boolean;
  cosmetics: Cosmetics;
}

export interface ChatMessage {
  id: string;        // unique message id
  playerId: PlayerId;
  name: string;      // sender display name
  text: string;      // sanitized message text
  timestamp: number; // server ms epoch
}

// client -> server
export type ClientMsg =
  | { t: "hello"; cosmetics: Cosmetics }
  | { t: "move"; x: number; y: number; facing: Facing; moving: boolean }
  | { t: "chat"; text: string };

// server -> client
export type ServerMsg =
  | { t: "welcome"; id: PlayerId; spawn: { x: number; y: number }; dayId: string; gateId: string }
  | { t: "state"; players: PlayerWire[]; spots: Spot[]; charge: number; gateId: string }
  | { t: "open"; url: string; title: string }
  | { t: "chat"; msg: ChatMessage }
  | { t: "history"; messages: ChatMessage[] };

export function encode(msg: ClientMsg | ServerMsg): string {
  return JSON.stringify(msg);
}

export function decode<T>(raw: string): T {
  return JSON.parse(raw) as T;
}

// Sanitize chat text: strip HTML/script tags, trim, and clamp length.
export function sanitizeChatText(raw: unknown, maxLen = 500): string {
  if (typeof raw !== "string") return "";
  let text = raw
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  if (text.length > maxLen) text = text.slice(0, maxLen);
  return text;
}
