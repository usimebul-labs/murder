import { type AuthContext, type Client, Room } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import type {
  ChatMessage,
  ClientMessages,
  CreateRoomOptions,
  ErrorCode,
  JoinRoomOptions,
  ServerMessages,
} from "@mm/game-protocol";
import type { Clue, Scenario } from "@mm/scenario-schema";
import { type AuthUser, verifyToken } from "../auth.js";
import {
  autoUnlockedClues,
  cluesAtLocation,
  currentRound,
  type GameFacts,
  pickEnding,
  renderPrivateScript,
  tallyVotes,
} from "../game-logic.js";
import { createPhaseActor } from "../phase-machine.js";
import { loadScenario } from "../scenario-loader.js";
import { CharacterInfo, ClueState, GameState, PhaseInfo, Player } from "../state.js";
import { createVoiceToken, voiceEnabled } from "../voice.js";

type MysteryClient = Client<{ auth: AuthUser }>;

const RECONNECT_SECONDS = 120;
const MAX_CHAT_LENGTH = 500;

export class MysteryRoom extends Room<{ state: GameState; client: MysteryClient }> {
  private scenario!: Scenario;
  private phase!: ReturnType<typeof createPhaseActor>;
  /** sessionId → 보유 단서 id */
  private owned = new Map<string, Set<string>>();
  /** sessionId → 지목한 캐릭터 id (결말 전까지 비공개) */
  private votes = new Map<string, string>();
  private chatLog: ChatMessage[] = [];
  private phaseTimer?: { clear(): void };

  static async onAuth(token: string, _options: unknown, _context: AuthContext) {
    return verifyToken(token);
  }

  async onCreate(options: CreateRoomOptions) {
    this.scenario = await loadScenario(options.scenarioVersionId);
    this.maxClients = this.scenario.meta.maxPlayers;
    this.phase = createPhaseActor(this.scenario.phases.length);

    const state = new GameState();
    state.scenarioTitle = this.scenario.meta.title;
    for (const c of this.scenario.characters) {
      state.characters.push(
        new CharacterInfo({
          id: c.id,
          name: c.name,
          publicProfile: c.publicProfile,
          colorIndex: c.colorIndex,
        }),
      );
    }
    for (const p of this.scenario.phases) {
      state.phases.push(
        new PhaseInfo({
          id: p.id,
          kind: p.kind,
          title: p.title,
          durationSec: p.durationSec,
          allowWhisper: p.allowWhisper,
          voiceEnabled: p.voiceEnabled,
        }),
      );
    }
    this.setState(state);
    this.setMetadata({ scenarioTitle: this.scenario.meta.title, preview: !!options.preview });
    this.registerMessages();
  }

  onJoin(client: MysteryClient, options: JoinRoomOptions = {}) {
    const auth = client.auth;
    if (!auth) throw new Error("인증 정보가 없습니다");
    client.view = new StateView();
    this.owned.set(client.sessionId, new Set());
    this.state.players.set(
      client.sessionId,
      new Player({
        userId: auth.userId,
        nickname: options.nickname?.slice(0, 20) || auth.nickname,
        isHost: this.state.players.size === 0,
      }),
    );
    // 이미 전체 공유된 단서는 새로 들어온 플레이어에게도 보인다
    for (const clue of this.state.clues.values()) {
      if (clue.sharedBy) client.view.add(clue);
    }
  }

  async onDrop(client: MysteryClient) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    await this.allowReconnection(client, RECONNECT_SECONDS);
  }

  onReconnect(client: MysteryClient) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = true;
  }

  onLeave(client: MysteryClient) {
    const player = this.state.players.get(client.sessionId);
    if (!player) return;
    if (this.state.status === "lobby") {
      this.state.players.delete(client.sessionId);
      this.owned.delete(client.sessionId);
      if (player.isHost) {
        const next = this.state.players.values().next().value;
        if (next) next.isHost = true;
      }
    } else {
      player.connected = false;
    }
  }

  onDispose() {
    this.phaseTimer?.clear();
    this.phase.stop();
    // TODO: 게임 기록(games, game_participants, game_chat_logs)을 DB에 저장
  }

  /* ───────── 메시지 처리 ───────── */

  private handle<K extends keyof ClientMessages>(
    type: K,
    handler: (
      client: MysteryClient,
      msg: ClientMessages[K],
      player: Player,
    ) => void | Promise<void>,
  ) {
    this.onMessage(type, async (client: MysteryClient, msg: ClientMessages[K]) => {
      const player = this.state.players.get(client.sessionId);
      if (!player) return;
      await handler(client, msg ?? ({} as ClientMessages[K]), player);
    });
  }

  private sendTo<K extends keyof ServerMessages>(
    client: MysteryClient,
    type: K,
    msg: ServerMessages[K],
  ) {
    client.send(type, msg);
  }

  private fail(client: MysteryClient, code: ErrorCode, message: string) {
    this.sendTo(client, "error", { code, message });
  }

  private registerMessages() {
    this.handle("character:select", (client, { characterId }, player) => {
      if (this.state.status !== "lobby")
        return this.fail(client, "not-allowed-in-phase", "게임 중에는 바꿀 수 없습니다");
      const character = this.scenario.characters.find((c) => c.id === characterId);
      if (!character) return this.fail(client, "invalid-message", "없는 캐릭터입니다");
      const taken = [...this.state.players.values()].some(
        (p) => p !== player && p.characterId === characterId,
      );
      if (taken) return this.fail(client, "character-taken", "다른 플레이어가 선택했습니다");
      player.characterId = characterId;
      player.ready = false;
      this.sendTo(client, "character:script", {
        characterId,
        privateScript: renderPrivateScript(character),
        goals: character.objectives.map((o) => o.text),
      });
    });

    this.handle("player:ready", (_client, { ready }, player) => {
      if (this.state.status === "lobby" && player.characterId) player.ready = !!ready;
    });

    this.handle("phase:advance", (client, _msg, player) => {
      if (!player.isHost) return this.fail(client, "not-host", "방장만 진행할 수 있습니다");
      if (this.state.status === "lobby") {
        const players = [...this.state.players.values()];
        const allReady = players.every((p) => p.characterId && p.ready);
        if (players.length < this.scenario.meta.minPlayers || !allReady) {
          return this.fail(
            client,
            "not-allowed-in-phase",
            "모든 플레이어가 준비해야 시작할 수 있습니다",
          );
        }
        this.phase.send({ type: "START" });
        this.state.status = "playing";
        this.lock();
      } else {
        this.phase.send({ type: "ADVANCE" });
      }
      this.syncPhase();
    });

    this.handle("chat:send", (client, { channel, text }, player) => {
      const clean = String(text ?? "")
        .trim()
        .slice(0, MAX_CHAT_LENGTH);
      if (!clean) return;
      const message: ChatMessage = {
        id: `${Date.now()}-${client.sessionId}`,
        channel,
        fromSessionId: client.sessionId,
        characterId: player.characterId || null,
        text: clean,
        sentAt: Date.now(),
      };
      if (channel === "all") {
        this.chatLog.push(message);
        this.broadcast("chat:message", message);
        return;
      }
      if (!this.currentPhase()?.allowWhisper) {
        return this.fail(client, "not-allowed-in-phase", "지금은 밀담할 수 없습니다");
      }
      const targetCharacterId = channel.slice("whisper:".length);
      const target = this.clientByCharacter(targetCharacterId);
      if (!target) return;
      this.chatLog.push(message);
      this.sendTo(client, "chat:message", message);
      this.sendTo(target, "chat:message", message);
    });

    this.handle("clue:investigate", (client, { location }, player) => {
      if (this.currentPhase()?.kind !== "investigation") {
        return this.fail(client, "not-allowed-in-phase", "조사 시간이 아닙니다");
      }
      const owned = this.owned.get(client.sessionId);
      if (!owned) return;
      const found = cluesAtLocation(this.scenario, location, player.characterId, this.facts());
      for (const clue of found) this.giveClue(client, clue);
    });

    this.handle("clue:share", (client, { clueId }, player) => {
      if (!this.owned.get(client.sessionId)?.has(clueId)) return;
      const clue = this.state.clues.get(clueId);
      if (!clue || clue.sharedBy) return;
      clue.sharedBy = player.characterId;
      for (const c of this.clients) {
        c.view?.add(clue);
        this.owned.get(c.sessionId)?.add(clueId);
      }
      for (const c of this.clients) this.grantAutoUnlocked(c);
    });

    this.handle("vote:cast", (client, { suspectCharacterId }, player) => {
      if (this.currentPhase()?.kind !== "vote") {
        return this.fail(client, "not-allowed-in-phase", "투표 시간이 아닙니다");
      }
      if (!this.scenario.characters.some((c) => c.id === suspectCharacterId)) return;
      this.votes.set(client.sessionId, suspectCharacterId);
      player.hasVoted = true;
    });

    this.handle("voice:token", async (client, _msg, player) => {
      if (!voiceEnabled())
        return this.fail(client, "invalid-message", "음성 서버가 설정되지 않았습니다");
      const phase = this.currentPhase();
      this.sendTo(
        client,
        "voice:token",
        await createVoiceToken({
          roomName: `${this.roomId}-all`,
          identity: client.sessionId,
          name: player.nickname,
          canPublish: phase ? phase.voiceEnabled : true,
        }),
      );
    });
  }

  /* ───────── 페이즈 진행 ───────── */

  private currentPhase() {
    return this.state.phaseIndex >= 0 ? this.scenario.phases[this.state.phaseIndex] : undefined;
  }

  private syncPhase() {
    this.phaseTimer?.clear();
    const snapshot = this.phase.getSnapshot();
    if (snapshot.status === "done") {
      this.state.status = "finished";
      this.state.phaseEndsAt = 0;
      return;
    }
    this.state.phaseIndex = snapshot.context.phaseIndex;
    const phase = this.currentPhase();
    if (!phase) return;

    this.state.phaseEndsAt = phase.durationSec > 0 ? Date.now() + phase.durationSec * 1000 : 0;
    if (phase.durationSec > 0) {
      this.phaseTimer = this.clock.setTimeout(() => {
        this.phase.send({ type: "ADVANCE" });
        this.syncPhase();
      }, phase.durationSec * 1000);
    }

    for (const client of this.clients) this.grantAutoUnlocked(client);

    if (phase.kind === "ending") {
      const accused = tallyVotes(this.votes.values());
      this.state.accusedCharacterId = accused ?? "";
      this.state.endingId = pickEnding(this.scenario, { ...this.facts(), accusedId: accused }).id;
    }

    this.broadcast("phase:changed", {
      phaseId: phase.id,
      kind: phase.kind,
      endsAt: this.state.phaseEndsAt || null,
    });
  }

  private giveClue(client: MysteryClient, clue: Clue, cascade = true) {
    const owned = this.owned.get(client.sessionId);
    if (!owned || owned.has(clue.id)) return;
    owned.add(clue.id);
    let entry = this.state.clues.get(clue.id);
    if (!entry) {
      entry = new ClueState({
        id: clue.id,
        code: clue.code,
        title: clue.title,
        body: clue.body,
        imageKey: clue.imageKey ?? "",
      });
      this.state.clues.set(clue.id, entry);
    }
    client.view?.add(entry);
    this.sendTo(client, "clue:acquired", {
      clue: {
        id: clue.id,
        code: clue.code,
        title: clue.title,
        body: clue.body,
        imageKey: clue.imageKey,
      },
    });
    if (cascade) this.grantAutoUnlocked(client);
  }

  /** 조건을 만족한 자동 해금 단서를 더 이상 없을 때까지 지급 (단서 연쇄 해금) */
  private grantAutoUnlocked(client: MysteryClient) {
    const characterId = this.state.players.get(client.sessionId)?.characterId;
    const owned = this.owned.get(client.sessionId);
    if (!characterId || !owned) return;
    for (;;) {
      const next = autoUnlockedClues(this.scenario, characterId, this.facts());
      if (next.length === 0) return;
      for (const clue of next) this.giveClue(client, clue, false);
    }
  }

  /** 조건 판정용 진행 상황. 공유된 단서는 모든 플레이어의 보유 목록에도 들어간다 */
  private facts(): GameFacts {
    const owned = new Map<string, ReadonlySet<string>>();
    const votes = new Map<string, string>();
    for (const [sessionId, p] of this.state.players) {
      if (!p.characterId) continue;
      owned.set(p.characterId, this.owned.get(sessionId) ?? new Set());
      const vote = this.votes.get(sessionId);
      if (vote) votes.set(p.characterId, vote);
    }
    const publicClueIds = new Set<string>();
    for (const clue of this.state.clues.values()) if (clue.sharedBy) publicClueIds.add(clue.id);
    return {
      round: currentRound(this.scenario, this.state.phaseIndex),
      owned,
      publicClueIds,
      votes,
    };
  }

  private clientByCharacter(characterId: string) {
    for (const [sessionId, p] of this.state.players) {
      if (p.characterId === characterId) return this.clients.getById(sessionId);
    }
    return undefined;
  }
}
