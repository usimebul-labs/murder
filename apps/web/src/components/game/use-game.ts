"use client";

import type { Room } from "@colyseus/sdk";
import {
  type ChatMessage,
  type ClientMessages,
  type CreateRoomOptions,
  type JoinRoomOptions,
  ROOM_NAME,
  type ServerMessages,
} from "@mm/game-protocol";
import type { PublicScenario } from "@mm/scenario-schema";
import { useCallback, useEffect, useRef, useState } from "react";
import { createGameClient } from "@/lib/game-client";
import { takeHandedOffRoom } from "@/lib/room-handoff";
import type { GameSnapshot, Script } from "./types";

export interface Toast {
  id: number;
  tone: "clue" | "info" | "error";
  title: string;
  desc?: string;
}

const tokenKey = (roomId: string) => `mm:reconnect:${roomId}`;

/** 초대 링크로 들어오면 닉네임을 묻지 않고 계정 닉네임으로 바로 입장한다 */
export const AUTO_JOIN = process.env.NEXT_PUBLIC_DEV_AUTH !== "1";

/** 게임 서버 방 연결과 상태 구독. 새로고침하면 재접속 토큰으로 자리를 이어받는다 */
export function useGame(scenarioVersionId: string, initialRoomId?: string) {
  const [room, setRoom] = useState<Room | null>(null);
  const [state, setState] = useState<GameSnapshot | null>(null);
  const [scenario, setScenario] = useState<PublicScenario | null>(null);
  const [script, setScript] = useState<Script | null>(null);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const roomRef = useRef<Room | null>(null);
  const toastId = useRef(0);

  const toast = useCallback((t: Omit<Toast, "id">) => {
    const id = ++toastId.current;
    setToasts((prev) => [...prev.slice(-3), { ...t, id }]);
    setTimeout(() => setToasts((prev) => prev.filter((x) => x.id !== id)), 5000);
  }, []);
  const dismiss = useCallback(
    (id: number) => setToasts((prev) => prev.filter((x) => x.id !== id)),
    [],
  );

  const attach = useCallback(
    (joined: Room, buffered: [string, unknown][] = []) => {
      roomRef.current = joined;
      setRoom(joined);
      try {
        sessionStorage.setItem(tokenKey(joined.roomId), joined.reconnectionToken);
      } catch {}
      if (new URLSearchParams(window.location.search).get("room") !== joined.roomId) {
        window.history.replaceState(null, "", `?room=${joined.roomId}`);
      }
      const handlers: Record<string, (m: never) => void> = {
        "scenario:public": (m: ServerMessages["scenario:public"]) => setScenario(m),
        "character:script": (m: Script) => setScript(m),
        "chat:history": (m: ChatMessage[]) => setChat(m),
        "chat:message": (m: ChatMessage) =>
          setChat((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
        "clue:acquired": (m: ServerMessages["clue:acquired"]) => {
          const label = {
            search: "새 단서를 얻었습니다",
            auto: "새 단서가 도착했습니다",
            public: "공통 자료가 공개되었습니다",
            given: "단서를 건네받았습니다",
          }[m.from];
          toast({ tone: "clue", title: label, desc: `${m.clue.code} · ${m.clue.title}` });
        },
        error: (m: ServerMessages["error"]) => toast({ tone: "error", title: m.message }),
      };
      joined.onStateChange((s: { toJSON(): GameSnapshot }) => setState(s.toJSON()));
      for (const [type, handler] of Object.entries(handlers)) joined.onMessage(type, handler);
      joined.onMessage("*", () => {});
      // 다른 화면에서 넘겨받은 연결이면, 그동안 받은 상태와 메시지를 다시 적용한다
      // 막 접속한 방은 첫 상태를 받기 전이라 빈 객체일 수 있으니, 이미 받은 경우에만 적용한다
      const current = (joined as Room<{ toJSON(): Partial<GameSnapshot> }>).state?.toJSON?.();
      if (current?.players) setState(current as GameSnapshot);
      for (const [type, message] of buffered) handlers[type]?.(message as never);
      joined.onLeave((code: number) => {
        if (code > 1001) setError("연결이 끊겼습니다. 새로고침하면 다시 입장합니다.");
      });
    },
    [toast],
  );

  // 화면을 떠나면 방에서 나간다. 개발 모드의 effect 재실행(마운트→해제→마운트)에서는
  // 넘겨받은 연결을 끊지 않도록 한 박자 늦게 확인한다
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      setTimeout(() => {
        if (!mounted.current) void roomRef.current?.leave();
      });
    };
  }, []);

  const connect = useCallback(
    async (nickname: string, preview: boolean) => {
      setError(null);
      setConnecting(true);
      try {
        const client = await createGameClient(nickname || undefined);
        const options = nickname ? { nickname } : {};
        const joined = initialRoomId
          ? await client.joinById(initialRoomId, options satisfies JoinRoomOptions)
          : await client.create(ROOM_NAME, {
              scenarioVersionId,
              preview,
              ...options,
            } satisfies CreateRoomOptions & JoinRoomOptions);
        attach(joined);
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setConnecting(false);
      }
    },
    [initialRoomId, scenarioVersionId, attach],
  );

  // 사건 상세 화면에서 방을 만들고 넘어왔으면 그 연결을 그대로 쓴다.
  // 새로고침: 이 탭에 재접속 토큰이 있으면 먼저 그 자리로 돌아간다
  const triedReconnect = useRef(false);
  useEffect(() => {
    if (triedReconnect.current || !initialRoomId) return;
    triedReconnect.current = true;
    const handed = takeHandedOffRoom(initialRoomId);
    if (handed) {
      attach(handed.room, handed.buffered);
      return;
    }
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(tokenKey(initialRoomId));
    } catch {}
    setConnecting(true);
    (async () => {
      if (token) {
        try {
          const client = await createGameClient();
          attach(await client.reconnect(token));
          return setConnecting(false);
        } catch {
          try {
            sessionStorage.removeItem(tokenKey(initialRoomId));
          } catch {}
        }
      }
      // 로그인한 계정의 닉네임으로 바로 입장한다 (개발용 인증은 닉네임을 직접 입력)
      if (AUTO_JOIN) await connect("", false);
      else setConnecting(false);
    })();
  }, [initialRoomId, attach, connect]);

  const send = useCallback(
    <K extends keyof ClientMessages>(type: K, payload: ClientMessages[K]) => {
      roomRef.current?.send(type, payload);
    },
    [],
  );

  return {
    room,
    state,
    scenario,
    script,
    chat,
    toasts,
    dismiss,
    toast,
    connecting,
    error,
    connect,
    send,
  };
}
