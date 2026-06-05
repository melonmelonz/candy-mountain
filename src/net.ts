import { encode, decode, type ClientMsg, type ServerMsg, type ChatMessage } from "./protocol";

export interface NetHandlers {
  onWelcome: (id: string, spawn: { x: number; y: number }, dayId: string) => void;
  onState: (msg: Extract<ServerMsg, { t: "state" }>) => void;
  onOpen: (url: string, title: string) => void;
  onChat?: (msg: ChatMessage) => void;
  onHistory?: (messages: ChatMessage[]) => void;
}

export function connect(handlers: NetHandlers): { send: (m: ClientMsg) => void; close: () => void } {
  const proto = location.protocol === "https:" ? "wss" : "ws";
  const ws = new WebSocket(`${proto}://${location.host}/room`);
  ws.addEventListener("message", (e) => {
    const msg = decode<ServerMsg>(e.data as string);
    if (msg.t === "welcome") handlers.onWelcome(msg.id, msg.spawn, msg.dayId);
    else if (msg.t === "state") handlers.onState(msg);
    else if (msg.t === "open") handlers.onOpen(msg.url, msg.title);
    else if (msg.t === "chat") handlers.onChat?.(msg.msg);
    else if (msg.t === "history") handlers.onHistory?.(msg.messages);
  });
  const send = (m: ClientMsg) => { if (ws.readyState === WebSocket.OPEN) ws.send(encode(m)); };
  return { send, close: () => ws.close() };
}
