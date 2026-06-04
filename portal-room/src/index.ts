import { PortalRoom } from "./room";
export { PortalRoom };

export interface Env {
  PORTAL_ROOM: DurableObjectNamespace;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname === "/room" || url.pathname === "/health") {
      const id = env.PORTAL_ROOM.idFromName("global");
      const stub = env.PORTAL_ROOM.get(id);
      return stub.fetch(req);
    }
    return new Response("candy-mountain-room", { status: 200 });
  },
};
