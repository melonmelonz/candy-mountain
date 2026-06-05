import type { Env } from "./index";
import type { Player, PlayerId, RoomState, Cosmetics, Facing, Flair } from "../../src/game/types";
import { ROOM_CONFIG, SPRITE_SHEET_COUNT } from "../../src/game/config";
import { tick } from "../../src/game/reducer";
import { encode, decode, sanitizeChatText, type ClientMsg, type PlayerWire, type ServerMsg, type ChatMessage } from "../../src/protocol";
import { todaysLink } from "./links";
import { generateCandidates, assignName } from "../../src/game/namegen";

const TICK_MS = 100; // 10 Hz
const SPAWN_MARGIN = 80;
// Drifters spawn out toward the edges, never on top of the portal, so every
// arrival has a journey inward. Reject any roll closer than this to the gate.
const MIN_PORTAL_DIST = 320;
// Everyone spawns on the non-inverted (left) side and funnels in from there;
// keep a small buffer off the seam so nobody starts in the inverted realm.
const SEAM_BUFFER = 40;
const FACINGS: Facing[] = ["up", "down", "left", "right"];
const FLAIRS: Flair[] = ["antenna", "backpack", "trail", "emblem"];
const DEFAULT_COSMETICS: Cosmetics = { hue: 0, visorHue: 0, flair: "antenna", sprite: 0 };
const MAX_CHAT_HISTORY = 10;
const CHAT_RATE_LIMIT_MS = 1000; // 1 msg/sec per player

interface SocketAttachment {
  id: PlayerId;
  cosmetics: Cosmetics;
}

function dayIdNow(): string {
  return new Date().toISOString().slice(0, 10); // UTC day boundary
}

function randomSpawn(): { x: number; y: number } {
  const portalX = ROOM_CONFIG.seamX;
  const portalY = ROOM_CONFIG.arenaHeight / 2;
  // Spawn only on the non-inverted (left) half, never on top of the portal.
  const xMin = SPAWN_MARGIN;
  const xMax = ROOM_CONFIG.seamX - SEAM_BUFFER;
  const yMin = SPAWN_MARGIN;
  const yMax = ROOM_CONFIG.arenaHeight - SPAWN_MARGIN;
  const roll = () => ({ x: xMin + Math.random() * (xMax - xMin), y: yMin + Math.random() * (yMax - yMin) });
  // Re-roll until the spawn lands at least MIN_PORTAL_DIST from the gate; bail
  // out after a bounded number of tries so a tiny arena can never hang here.
  for (let i = 0; i < 24; i++) {
    const p = roll();
    if (Math.hypot(p.x - portalX, p.y - portalY) >= MIN_PORTAL_DIST) return p;
  }
  return roll();
}

function sanitizeCosmetics(raw: unknown): Cosmetics {
  if (typeof raw !== "object" || raw === null) return { ...DEFAULT_COSMETICS };
  const c = raw as Record<string, unknown>;
  const hue =
    typeof c.hue === "number" && Number.isFinite(c.hue) ? (((c.hue % 360) + 360) % 360) : 0;
  const visorHue =
    typeof c.visorHue === "number" && Number.isFinite(c.visorHue) ? (((c.visorHue % 360) + 360) % 360) : 0;
  const flair = FLAIRS.includes(c.flair as Flair) ? (c.flair as Flair) : "antenna";
  const sprite =
    typeof c.sprite === "number" && Number.isInteger(c.sprite) && c.sprite >= 0 && c.sprite < SPRITE_SHEET_COUNT
      ? c.sprite
      : 0;
  return { hue, visorHue, flair, sprite };
}

// Names are auto-assigned and unique among currently-present players. They are
// not persisted, so reconnecting players get a fresh name.
function generateUniqueName(id: PlayerId, existing: Record<PlayerId, Player>): string {
  const candidates = generateCandidates(id, 15);
  const taken = new Set(Object.values(existing).map((p) => p.name));
  return assignName(candidates, taken);
}

export class PortalRoom implements DurableObject {
  private players: Record<PlayerId, Player> = {};
  private charge = 0;
  private spots: RoomState["spots"] = [];
  private socketFor = new Map<WebSocket, PlayerId>();
  private alarmSet = false;
  private chatHistory: ChatMessage[] = [];
  private lastChatAt = new Map<PlayerId, number>();

  constructor(private state: DurableObjectState, private env: Env) {
    // Durable, SQLite-backed log of every portal opening. Survives hibernation
    // eviction and DO restarts (unlike the in-memory game state below). Each row
    // records the UTC day, the wall-clock time of the open, and how many drifters
    // were present at the moment it opened.
    this.state.storage.sql.exec(
      `CREATE TABLE IF NOT EXISTS portal_opens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        day_id TEXT NOT NULL,
        opened_at INTEGER NOT NULL,
        present INTEGER NOT NULL
      )`,
    );
    // In-memory state is lost on hibernation eviction; getWebSockets() is the
    // source of truth. Re-adopt surviving sockets AND rebuild their player
    // records so reconnected players are not permanently ghosted. Position is
    // not preserved across eviction (would cost a storage write per tick), so
    // players respawn; cosmetics persist via the socket attachment.
    for (const ws of this.state.getWebSockets()) {
      const att = ws.deserializeAttachment() as SocketAttachment | null;
      if (!att?.id) continue;
      this.socketFor.set(ws, att.id);
      this.players[att.id] = {
        id: att.id,
        name: generateUniqueName(att.id, this.players),
        pos: randomSpawn(),
        facing: "down",
        moving: false,
        cosmetics: att.cosmetics ?? { ...DEFAULT_COSMETICS },
        lastInputAt: Date.now(),
      };
    }
    // If sockets survived but reconstruction was triggered by a message/close
    // (not the alarm), the tick loop must be restarted.
    if (this.state.getWebSockets().length > 0) this.ensureAlarm();
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
    const attachment: SocketAttachment = { id, cosmetics: { ...DEFAULT_COSMETICS } };
    server.serializeAttachment(attachment);
    this.socketFor.set(server, id);

    const spawn = randomSpawn();
    const dayId = dayIdNow();
    this.players[id] = {
      id,
      name: generateUniqueName(id, this.players),
      pos: spawn,
      facing: "down",
      moving: false,
      cosmetics: { ...DEFAULT_COSMETICS },
      lastInputAt: Date.now(),
    };
    server.send(encode({ t: "welcome", id, spawn, dayId } satisfies ServerMsg));
    if (this.chatHistory.length > 0) {
      server.send(encode({ t: "history", messages: this.chatHistory } satisfies ServerMsg));
    }
    this.ensureAlarm();

    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, raw: string) {
    const id = this.socketFor.get(ws);
    if (!id) return;

    let msg: ClientMsg;
    try {
      msg = decode<ClientMsg>(raw);
    } catch {
      return; // ignore malformed frames
    }
    if (typeof msg !== "object" || msg === null) return;

    // Lazily recreate a player record if it was lost (belt-and-suspenders with
    // the constructor rebuild; covers any reconstruction edge).
    let p = this.players[id];
    if (!p) {
      p = {
        id,
        name: generateUniqueName(id, this.players),
        pos: randomSpawn(),
        facing: "down",
        moving: false,
        cosmetics: { ...DEFAULT_COSMETICS },
        lastInputAt: Date.now(),
      };
      this.players[id] = p;
    }

    p.lastInputAt = Date.now();
    if (msg.t === "hello") {
      p.cosmetics = sanitizeCosmetics(msg.cosmetics);
      const att: SocketAttachment = { id, cosmetics: p.cosmetics };
      ws.serializeAttachment(att);
    } else if (msg.t === "move") {
      const x = Number(msg.x);
      const y = Number(msg.y);
      if (Number.isFinite(x)) p.pos.x = Math.max(0, Math.min(ROOM_CONFIG.arenaWidth, x));
      if (Number.isFinite(y)) p.pos.y = Math.max(0, Math.min(ROOM_CONFIG.arenaHeight, y));
      if (FACINGS.includes(msg.facing)) p.facing = msg.facing;
      p.moving = msg.moving === true;
    } else if (msg.t === "chat") {
      this.handleChatMessage(id, p.name, msg.text);
    }
  }

  private handleChatMessage(playerId: PlayerId, playerName: string, rawText: unknown) {
    const now = Date.now();
    const lastChat = this.lastChatAt.get(playerId) ?? 0;
    if (now - lastChat < CHAT_RATE_LIMIT_MS) return; // drop rate-limited frames

    const text = sanitizeChatText(rawText, 500);
    if (text.length === 0) return; // ignore empty/stripped messages

    const chatMsg: ChatMessage = {
      id: crypto.randomUUID(),
      playerId,
      name: playerName,
      text,
      timestamp: now,
    };
    this.chatHistory.push(chatMsg);
    if (this.chatHistory.length > MAX_CHAT_HISTORY) {
      this.chatHistory = this.chatHistory.slice(-MAX_CHAT_HISTORY);
    }
    this.lastChatAt.set(playerId, now);
    this.broadcast(encode({ t: "chat", msg: chatMsg } satisfies ServerMsg));
  }

  async webSocketClose(ws: WebSocket) {
    this.drop(ws);
  }
  async webSocketError(ws: WebSocket) {
    this.drop(ws);
  }

  private drop(ws: WebSocket) {
    const id = this.socketFor.get(ws);
    if (id) {
      delete this.players[id];
      this.socketFor.delete(ws);
      this.lastChatAt.delete(id);
    }
  }

  private ensureAlarm() {
    if (this.alarmSet) return;
    this.alarmSet = true;
    this.state.storage.setAlarm(Date.now() + TICK_MS).catch(() => {
      // Allow a future re-arm if scheduling failed.
      this.alarmSet = false;
    });
  }

  async alarm() {
    this.alarmSet = false;
    try {
      const now = Date.now();
      const dayId = dayIdNow();

      const result = tick(
        { players: this.players, spots: this.spots, charge: this.charge, dayId },
        now,
        ROOM_CONFIG,
      );
      this.spots = result.state.spots;
      this.charge = result.state.charge;

      const playersWire: PlayerWire[] = Object.values(this.players).map((p) => ({
        id: p.id,
        name: p.name,
        x: p.pos.x,
        y: p.pos.y,
        facing: p.facing,
        moving: p.moving,
        cosmetics: p.cosmetics,
      }));
      this.broadcast(
        encode({ t: "state", players: playersWire, spots: this.spots, charge: this.charge }),
      );

      if (result.opened) {
        this.state.storage.sql.exec(
          "INSERT INTO portal_opens (day_id, opened_at, present) VALUES (?, ?, ?)",
          dayId,
          now,
          Object.keys(this.players).length,
        );
        const link = todaysLink(dayId);
        if (link) this.broadcast(encode({ t: "open", url: link.url, title: link.title }));
      }
    } finally {
      // Keep ticking while anyone is connected, even if this tick threw.
      if (this.state.getWebSockets().length > 0) this.ensureAlarm();
    }
  }

  private broadcast(data: string) {
    for (const ws of this.state.getWebSockets()) {
      try {
        ws.send(data);
      } catch {
        /* socket gone; cleaned on close */
      }
    }
  }
}
