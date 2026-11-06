import { createEndpoint, createRouter, defineRoom, defineServer } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_NAME } from "@mm/game-protocol";
import { config } from "./config.js";
import { MysteryRoom } from "./rooms/mystery-room.js";

const health = createEndpoint("/health", { method: "GET" }, async (ctx) => ctx.json({ ok: true }));

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(MysteryRoom),
  },
  routes: createRouter({ health }),
  transport: new WebSocketTransport(),
});

await server.listen(config.port);
console.log(`게임 서버 실행 중: ws://localhost:${config.port}`);
