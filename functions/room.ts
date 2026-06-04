interface Env { PORTAL_ROOM: DurableObjectNamespace; }
export const onRequest: PagesFunction<Env> = (ctx) => {
  const id = ctx.env.PORTAL_ROOM.idFromName("global");
  return ctx.env.PORTAL_ROOM.get(id).fetch(ctx.request);
};
