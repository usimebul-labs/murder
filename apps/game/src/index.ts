import { createEndpoint, createRouter, defineRoom, defineServer, matchMaker } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { ROOM_CODE_PATTERN, ROOM_NAME, type RoomListing } from "@mm/game-protocol";
import { config } from "./config.js";
import { MysteryRoom } from "./rooms/mystery-room.js";

const health = createEndpoint("/health", { method: "GET" }, async (ctx) => ctx.json({ ok: true }));

const toListing = (m: Partial<RoomListing> | undefined, roomId: string): RoomListing => ({
  code: roomId,
  scenarioVersionId: m?.scenarioVersionId ?? "",
  title: m?.title ?? "",
  tags: m?.tags ?? [],
  players: m?.players ?? 0,
  maxPlayers: m?.maxPlayers ?? 0,
  status: m?.status ?? "waiting",
  test: m?.test ?? false,
});

/** 대기실 목록: 공개 방만, ?scenario=<시나리오 버전 id>로 거른다 */
const listRooms = createEndpoint("/rooms", { method: "GET" }, async (ctx) => {
  const scenario = new URL(ctx.request?.url ?? "/", "http://local").searchParams.get("scenario");
  const rooms = await matchMaker.query({ name: ROOM_NAME, private: false });
  const list = rooms
    .map((r) => toListing(r.metadata, r.roomId))
    .filter((r) => !scenario || r.scenarioVersionId === scenario)
    .sort((a, b) => Number(a.status !== "waiting") - Number(b.status !== "waiting"));
  return ctx.json({ rooms: list });
});

/** 초대 코드로 방 찾기 (비공개 방 포함). 코드 입장 전 확인용 */
const findRoom = createEndpoint("/rooms/:code", { method: "GET" }, async (ctx) => {
  const code = String(ctx.params.code ?? "").toUpperCase();
  if (!ROOM_CODE_PATTERN.test(code)) return ctx.json({ room: null });
  const [room] = await matchMaker.query({ name: ROOM_NAME, roomId: code });
  return ctx.json({ room: room ? toListing(room.metadata, room.roomId) : null });
});

const server = defineServer({
  rooms: {
    [ROOM_NAME]: defineRoom(MysteryRoom),
  },
  routes: createRouter({ health, listRooms, findRoom }),
  transport: new WebSocketTransport(),
});

await server.listen(config.port);
console.log(`게임 서버 실행 중: ws://localhost:${config.port}`);
