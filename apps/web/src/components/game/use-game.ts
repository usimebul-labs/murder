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
import type { GameSnapshot, Script } from "./types";

export interface Toast {
  id: number;
  tone: "clue" | "info" | "error";
  title: string;
  desc?: string;
}

const tokenKey = (roomId: string) => `mm:reconnect:${roomId}`;

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
    (joined: Room) => {
      roomRef.current = joined;
      setRoom(joined);
      try {
        sessionStorage.setItem(tokenKey(joined.roomId), joined.reconnectionToken);
      } catch {}
      if (new URLSearchParams(window.location.search).get("room") !== joined.roomId) {
        window.history.replaceState(null, "", `?room=${joined.roomId}`);
      }
      joined.onStateChange((s: { toJSON(): GameSnapshot }) => setState(s.toJSON()));
      joined.onMessage("scenario:public", (m: ServerMessages["scenario:public"]) => setScenario(m));
      joined.onMessage("character:script", (m: Script) => setScript(m));
      joined.onMessage("chat:history", (m: ChatMessage[]) => setChat(m));
      joined.onMessage("chat:message", (m: ChatMessage) =>
        setChat((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m])),
      );
      joined.onMessage("clue:acquired", (m: ServerMessages["clue:acquired"]) => {
        const label = {
          search: "새 단서를 얻었습니다",
          auto: "새 단서가 도착했습니다",
          public: "공통 자료가 공개되었습니다",
          given: "단서를 건네받았습니다",
        }[m.from];
        toast({ tone: "clue", title: label, desc: `${m.clue.code} · ${m.clue.title}` });
      });
      joined.onMessage("error", (m: ServerMessages["error"]) =>
        toast({ tone: "error", title: m.message }),
      );
      joined.onMessage("*", () => {});
      joined.onLeave((code: number) => {
        if (code > 1001) setError("연결이 끊겼습니다. 새로고침하면 다시 입장합니다.");
      });
    },
    [toast],
  );

  useEffect(() => () => void roomRef.current?.leave(), []);

  // 새로고침: 이 탭에 재접속 토큰이 있으면 먼저 그 자리로 돌아간다
  const triedReconnect = useRef(false);
  useEffect(() => {
    if (triedReconnect.current || !initialRoomId) return;
    triedReconnect.current = true;
    let token: string | null = null;
    try {
      token = sessionStorage.getItem(tokenKey(initialRoomId));
    } catch {}
    if (!token) return;
    setConnecting(true);
    (async () => {
      try {
        const client = await createGameClient();
        attach(await client.reconnect(token));
      } catch {
        try {
          sessionStorage.removeItem(tokenKey(initialRoomId));
        } catch {}
      } finally {
        setConnecting(false);
      }
    })();
  }, [initialRoomId, attach]);

  async function connect(nickname: string, preview: boolean) {
    setError(null);
    setConnecting(true);
    try {
      const client = await createGameClient(nickname || undefined);
      const joined = initialRoomId
        ? await client.joinById(initialRoomId, { nickname } satisfies JoinRoomOptions)
        : await client.create(ROOM_NAME, {
            scenarioVersionId,
            preview,
            nickname,
          } satisfies CreateRoomOptions & JoinRoomOptions);
      attach(joined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setConnecting(false);
    }
  }

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
