import type { Env } from "./index";
import type { Player, PlayerId, RoomState, Cosmetics } from "../../src/game/types";
import { ROOM_CONFIG } from "../../src/game/config";
import { tick } from "../../src/game/reducer";
import { encode, decode, type ClientMsg, type PlayerWire, type ServerMsg } from "../../src/protocol";
import { todaysLink } from "./links";

const TICK_MS = 100; // 10 Hz
const SPAWN_MARGIN = 80;

function dayIdNow(): string {
  return new Date().toISOString().slice(0, 10); // UTC day boundary
}

export class PortalRoom implements DurableObject {
  private players: Record<PlayerId, Player> = {};
  private charge = 0;
  private spots: RoomState["spots"] = [];
  private socketFor = new Map<WebSocket, PlayerId>();
  private alarmSet = false;

  constructor(private state: DurableObjectState, private env: Env) {
    // Re-adopt sockets that survived hibernation.
    for (const ws of this.state.getWebSockets()) {
      const id = (ws.deserializeAttachment() as { id: PlayerId } | null)?.id;
      if (id) this.socketFor.set(ws, id);
    }
  }

  async fetch(req: Request): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/health") return new Response("ok");
    if (url.pathname !== "/room") return new Response("not found", { status: 404 });
    if (req.headers.get("Upgrade") !== "websocket")
      return new Response("expected websocket", { status: 426 });

    const pair = new WebSocketPair();
    const [client, server] = [pair[0], pair[1]];
    this.state.acceptWebSocket(server);

    const id = crypto.randomUUID();
    server.serializeAttachment({ id });
    this.socketFor.set(server, id);

    const spawn = {
      x: SPAWN_MARGIN + Math.random() * (ROOM_CONFIG.arenaWidth - SPAWN_MARGIN * 2),
      y: SPAWN_MARGIN + Math.random() * (ROOM_CONFIG.arenaHeight - SPAWN_MARGIN * 2),
    };
    const dayId = dayIdNow();
    this.players[id] = {
      id, pos: spawn, facing: "down", moving: false,
      cosmetics: { hue: 0, visorHue: 0, flair: "antenna" },
      lastInputAt: Date.now(),
    };
    server.send(encode({ t: "welcome", id, spawn, dayId } satisfies ServerMsg));
    this.ensureAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const id = this.socketFor.get(ws);
    if (!id) return;
    const p = this.players[id];
    if (!p) return;
    const msg = decode<ClientMsg>(raw);
    p.lastInputAt = Date.now();
    if (msg.t === "hello") {
      p.cosmetics = msg.cosmetics as Cosmetics;
    } else if (msg.t === "move") {
      p.pos = {
        x: Math.max(0, Math.min(ROOM_CONFIG.arenaWidth, msg.x)),
        y: Math.max(0, Math.min(ROOM_CONFIG.arenaHeight, msg.y)),
      };
      p.facing = msg.facing;
      p.moving = msg.moving;
    }
  }

  async webSocketClose(ws: WebSocket) { this.drop(ws); }
  async webSocketError(ws: WebSocket) { this.drop(ws); }

  private drop(ws: WebSocket) {
    const id = this.socketFor.get(ws);
    if (id) { delete this.players[id]; this.socketFor.delete(ws); }
  }

  private ensureAlarm() {
    if (!this.alarmSet) {
      this.alarmSet = true;
      this.state.storage.setAlarm(Date.now() + TICK_MS);
    }
  }

  async alarm() {
    this.alarmSet = false;
    const now = Date.now();
    const dayId = dayIdNow();

    const result = tick(
      { players: this.players, spots: this.spots, charge: this.charge, dayId },
      now, ROOM_CONFIG,
    );
    this.spots = result.state.spots;
    this.charge = result.state.charge;

    const playersWire: PlayerWire[] = Object.values(this.players).map((p) => ({
      id: p.id, x: p.pos.x, y: p.pos.y, facing: p.facing, moving: p.moving, cosmetics: p.cosmetics,
    }));
    this.broadcast(encode({ t: "state", players: playersWire, spots: this.spots, charge: this.charge }));

    if (result.opened) {
      const link = todaysLink(dayId);
      this.broadcast(encode({ t: "open", url: link.url, title: link.title }));
    }

    // Keep ticking only while someone is connected.
    if (this.state.getWebSockets().length > 0) this.ensureAlarm();
  }

  private broadcast(data: string) {
    for (const ws of this.state.getWebSockets()) {
      try { ws.send(data); } catch { /* socket gone; cleaned on close */ }
    }
  }
}
