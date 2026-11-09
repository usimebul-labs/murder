import { type AuthContext, type Client, Room } from "@colyseus/core";
import { StateView } from "@colyseus/schema";
import type {
  ChatMessage,
  ClientMessages,
  ClueView,
  CreateRoomOptions,
  ErrorCode,
  GameResult,
  JoinRoomOptions,
  ServerMessages,
} from "@mm/game-protocol";
import { type Clue, type Phase, type Scenario, toPublicScenario } from "@mm/scenario-schema";
import { type AuthUser, verifyToken } from "../auth.js";
import {
  boardClues,
  canSee,
  currentRound,
  type GameFacts,
  isUnlocked,
  pickEnding,
  renderEndingBody,
  scoreCharacter,
  shuffle,
  topVoted,
  turnSequence,
} from "../game-logic.js";
import { josa } from "../josa.js";
import { createPhaseActor } from "../phase-machine.js";
import { loadScenario } from "../scenario-loader.js";
import {
  CharacterInfo,
  ClueCard,
  ClueState,
  GameState,
  JuryItem,
  PhaseInfo,
  Player,
} from "../state.js";
import { createVoiceToken, voiceEnabled } from "../voice.js";

type MysteryClient = Client<{ auth: AuthUser }>;
type Timer = { clear(): void };

const RECONNECT_SECONDS = 120;
const MAX_CHAT_LENGTH = 500;
const MAX_CHAT_LOG = 1000;
/** 탐색 한 차례의 제한 시간 (페이즈 시간을 차례 수로 나눠 이 범위로 자른다) */
const TURN_SEC_MIN = 15;
const TURN_SEC_MAX = 45;

export class MysteryRoom extends Room<{ state: GameState; client: MysteryClient }> {
  private scenario!: Scenario;
  private phase!: ReturnType<typeof createPhaseActor>;
  /** 캐릭터 id → 지금 가진 단서 id */
  private owned = new Map<string, Set<string>>();
  /** 캐릭터 id → 한 번이라도 가졌던 단서 id (자동 배포 중복 방지, clue-collected 판정) */
  private collected = new Map<string, Set<string>>();
  /** 캐릭터 id → 지목한 캐릭터 id (결말 전까지 비공개) */
  private votes = new Map<string, string>();
  /** 판정단 항목 키 → (판정한 캐릭터 id → 달성 여부) */
  private juryVotes = new Map<string, Map<string, boolean>>();
  private chatLog: ChatMessage[] = [];
  private castingDone = false;
  private turnSeq: string[] = [];
  private turnIndex = -1;
  private speakerIndex = -1;
  private phaseTimer?: Timer;
  private turnTimer?: Timer;
  private speakerTimer?: Timer;

  static async onAuth(token: string, _options: unknown, _context: AuthContext) {
    return verifyToken(token);
  }

  async onCreate(options: CreateRoomOptions) {
    this.scenario = await loadScenario(options.scenarioVersionId);
    // 재접속 대기 중인 자리와 관전자를 위해 여유를 둔다. 플레이어 수는 onJoin에서 제한한다
    this.maxClients = this.scenario.meta.maxPlayers * 2;
    this.phase = createPhaseActor(this.scenario.phases.length);
    this.castingDone = !this.hasSelectPhase();

    const state = new GameState();
    state.scenarioTitle = this.scenario.meta.title;
    state.preview = !!options.preview;
    state.minPlayers = this.scenario.meta.minPlayers;
    for (const c of this.scenario.characters) {
      state.characters.push(
        new CharacterInfo({
          id: c.id,
          name: c.name,
          role: c.role,
          publicProfile: c.publicProfile,
          portraitKey: c.portraitKey ?? "",
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
          titleCard: p.titleCard ?? "",
          durationSec: p.durationSec,
          round: "round" in p ? p.round : 0,
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

    // 새로고침 등으로 끊겼던 같은 사용자는 원래 자리를 이어받는다
    const previous = [...this.state.players].find(
      ([, p]) => p.userId === auth.userId && !p.connected,
    );
    if (previous) {
      const [oldSessionId, player] = previous;
      this.state.players.delete(oldSessionId);
      player.connected = true;
      this.state.players.set(client.sessionId, player);
    } else {
      if (this.state.status !== "lobby") throw new Error("이미 시작된 사건입니다");
      if (this.state.players.size >= this.scenario.meta.maxPlayers) {
        throw new Error("방이 가득 찼습니다");
      }
      this.state.players.set(
        client.sessionId,
        new Player({
          userId: auth.userId,
          nickname: options.nickname?.slice(0, 20) || auth.nickname,
          isHost: this.state.players.size === 0,
        }),
      );
    }

    this.sendTo(client, "scenario:public", toPublicScenario(this.scenario));
    this.restoreClient(client);
  }

  async onDrop(client: MysteryClient) {
    const player = this.state.players.get(client.sessionId);
    if (player) player.connected = false;
    if (player?.characterId && player.characterId === this.state.turnCharacterId) {
      this.clock.setTimeout(() => this.autoPick(), 3000);
    }
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
      if (player.isHost) {
        const next = this.state.players.values().next().value;
        if (next) next.isHost = true;
      }
    } else {
      player.connected = false;
      if (player.isHost) {
        const next = [...this.state.players.values()].find((p) => p.connected);
        if (next) {
          player.isHost = false;
          next.isHost = true;
        }
      }
    }
  }

  onDispose() {
    this.clearTimers();
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
      const selecting =
        this.currentPhase()?.kind === "character-select" ||
        (this.state.status === "lobby" && !this.hasSelectPhase());
      if (!selecting || this.castingDone)
        return this.fail(client, "not-allowed-in-phase", "지금은 인물을 고를 수 없습니다");
      if (characterId === "") {
        player.characterId = "";
        player.done = false;
        return;
      }
      if (!this.scenario.characters.some((c) => c.id === characterId))
        return this.fail(client, "invalid-message", "없는 인물입니다");
      const taken = [...this.state.players.values()].some(
        (p) => p !== player && p.characterId === characterId,
      );
      if (taken) return this.fail(client, "character-taken", "다른 참가자가 고른 인물입니다");
      player.characterId = characterId;
      player.done = false;
      player.ready = false;
    });

    this.handle("player:ready", (_client, { ready }, player) => {
      if (this.state.status !== "lobby") return;
      if (!this.hasSelectPhase() && !player.characterId) return;
      player.ready = !!ready;
    });

    this.handle("player:done", (client, { done }, player) => {
      const phase = this.currentPhase();
      if (!phase) return;
      if (phase.kind === "final-statements") {
        if (player.characterId && player.characterId === this.state.speakerCharacterId) {
          this.nextSpeaker();
        }
        return;
      }
      if (phase.kind === "investigation" || phase.kind === "vote") {
        return this.fail(client, "not-allowed-in-phase", "이 단계에서는 쓸 수 없습니다");
      }
      player.done = !!done;
      this.checkAllDone();
    });

    this.handle("phase:advance", (client, _msg, player) => {
      if (!player.isHost) return this.fail(client, "not-host", "방장만 진행할 수 있습니다");
      if (this.state.status === "finished") return;
      if (this.state.status === "lobby") {
        const problem = this.startProblem();
        if (problem) return this.fail(client, "not-allowed-in-phase", problem);
        this.state.status = "playing";
        this.phase.send({ type: "START" });
        if (this.castingDone) this.sendScripts();
        this.syncPhase();
        return;
      }
      if (this.currentPhase()?.kind === "vote" && !this.state.accusedCharacterId) {
        this.resolveVote(true);
        return;
      }
      this.advancePhase();
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
        this.pushChat(message);
        this.broadcast("chat:message", message);
        return;
      }
      if (!this.currentPhase()?.allowWhisper) {
        return this.fail(client, "not-allowed-in-phase", "지금은 밀담할 수 없습니다");
      }
      if (!player.characterId) return;
      const target = this.clientByCharacter(channel.slice("whisper:".length));
      if (!target || target === client) return;
      this.pushChat(message);
      this.sendTo(client, "chat:message", message);
      this.sendTo(target, "chat:message", message);
    });

    this.handle("clue:pick", (client, { clueId }, player) => {
      if (this.currentPhase()?.kind !== "investigation") {
        return this.fail(client, "not-allowed-in-phase", "탐색 시간이 아닙니다");
      }
      if (!player.characterId || player.characterId !== this.state.turnCharacterId) {
        return this.fail(client, "not-your-turn", "아직 당신의 차례가 아닙니다");
      }
      const clue = this.availableFor(player.characterId).find((c) => c.id === clueId);
      if (!clue) return this.fail(client, "invalid-message", "가져갈 수 없는 단서입니다");
      this.pick(player.characterId, clue);
    });

    this.handle("clue:share", (client, { clueId }, player) => {
      const kind = this.currentPhase()?.kind;
      const phase = this.currentPhase();
      const allowed =
        (phase?.kind === "discussion" && phase.allowReveal) || kind === "final-statements";
      if (!allowed) return this.fail(client, "not-allowed-in-phase", "지금은 공개할 수 없습니다");
      if (!this.owned.get(player.characterId)?.has(clueId)) return;
      const card = this.state.cards.get(clueId);
      if (!card || card.isPublic) return;
      card.isPublic = true;
      card.sharedBy = player.characterId;
      const entry = this.clueState(clueId);
      for (const c of this.clients) c.view?.add(entry);
      this.announce(
        `${josa(this.characterName(player.characterId), "이/가")} 단서를 공개했습니다 — ${card.code} · ${entry.title}`,
      );
      this.distribute();
    });

    this.handle("clue:give", (client, { clueId, toCharacterId }, player) => {
      const phase = this.currentPhase();
      if (phase?.kind !== "discussion" || !phase.allowHandOver) {
        return this.fail(client, "not-allowed-in-phase", "지금은 단서를 건넬 수 없습니다");
      }
      const from = player.characterId;
      if (!from || !this.owned.get(from)?.has(clueId)) return;
      if (toCharacterId === from || !this.assignedCharacterIds().includes(toCharacterId)) {
        return this.fail(client, "invalid-message", "건넬 수 없는 상대입니다");
      }
      const card = this.state.cards.get(clueId);
      const clue = this.clueById(clueId);
      if (!card || !clue) return;
      this.owned.get(from)?.delete(clueId);
      card.holderId = toCharacterId;
      if (!card.isPublic) client.view?.remove(this.clueState(clueId));
      this.giveClue(toCharacterId, clue, "given");
      this.announce(
        `${josa(this.characterName(from), "이/가")} ${this.characterName(toCharacterId)}에게 단서 ${josa(card.code, "을/를")} 건넸습니다`,
      );
      this.distribute();
    });

    this.handle("vote:cast", (client, { suspectCharacterId }, player) => {
      const phase = this.currentPhase();
      if (phase?.kind !== "vote") {
        return this.fail(client, "not-allowed-in-phase", "투표 시간이 아닙니다");
      }
      if (!player.characterId) return;
      if (this.state.accusedCharacterId || this.votes.has(player.characterId)) {
        return this.fail(client, "invalid-message", "이미 지목을 확정했습니다");
      }
      const candidates = this.voteCandidates();
      if (!candidates.includes(suspectCharacterId)) {
        return this.fail(client, "invalid-message", "지목할 수 없는 인물입니다");
      }
      if (!phase.allowSelfVote && suspectCharacterId === player.characterId) {
        return this.fail(client, "invalid-message", "자기 자신은 지목할 수 없습니다");
      }
      this.votes.set(player.characterId, suspectCharacterId);
      player.hasVoted = true;
      const voters = this.assignedPlayers();
      if (voters.every((p) => p.hasVoted)) this.resolveVote(false);
    });

    this.handle("jury:vote", (client, { characterId, objectiveId, achieved }, player) => {
      if (this.currentPhase()?.kind !== "objectives-review") {
        return this.fail(client, "not-allowed-in-phase", "목표 결산 중에만 판정할 수 있습니다");
      }
      const key = `${characterId}:${objectiveId}`;
      const item = this.state.jury.get(key);
      const voter = player.characterId;
      if (!item || !voter || voter === characterId) return;
      const votes = this.juryVotes.get(key) ?? new Map<string, boolean>();
      if (votes.has(voter)) return;
      votes.set(voter, !!achieved);
      this.juryVotes.set(key, votes);
      if (achieved) item.yes += 1;
      else item.no += 1;
      item.voters.push(voter);
      this.computeResult();
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

  private currentPhase(): Phase | undefined {
    return this.state.phaseIndex >= 0 ? this.scenario.phases[this.state.phaseIndex] : undefined;
  }

  private hasSelectPhase() {
    return this.scenario.phases.some((p) => p.kind === "character-select");
  }

  private startProblem(): string | null {
    const players = [...this.state.players.values()];
    if (!this.state.preview && players.length < this.scenario.meta.minPlayers) {
      return `${this.scenario.meta.minPlayers}명이 모여야 시작할 수 있습니다`;
    }
    if (!players.every((p) => p.ready)) return "모든 참가자가 준비해야 시작할 수 있습니다";
    if (!this.hasSelectPhase() && !players.every((p) => p.characterId)) {
      return "모든 참가자가 인물을 골라야 시작할 수 있습니다";
    }
    return null;
  }

  private advancePhase() {
    this.onExitPhase();
    this.phase.send({ type: "ADVANCE" });
    this.syncPhase();
  }

  private onExitPhase() {
    const phase = this.currentPhase();
    if (phase?.kind === "character-select") this.finishCasting();
  }

  private syncPhase() {
    this.clearTimers();
    const snapshot = this.phase.getSnapshot();
    if (snapshot.status === "done") {
      this.state.status = "finished";
      this.state.phaseEndsAt = 0;
      this.computeResult(true);
      this.announce("사건이 종결되었습니다");
      return;
    }
    this.state.phaseIndex = snapshot.context.phaseIndex;
    const phase = this.currentPhase();
    if (!phase) return;

    for (const p of this.state.players.values()) p.done = false;
    this.state.turnCharacterId = "";
    this.state.speakerCharacterId = "";
    this.state.phaseEndsAt = phase.durationSec > 0 ? Date.now() + phase.durationSec * 1000 : 0;
    if (phase.durationSec > 0) {
      this.phaseTimer = this.clock.setTimeout(
        () => this.onPhaseTimeout(),
        phase.durationSec * 1000,
      );
    }

    this.announce(`${josa(phase.title, "을/를")} 시작합니다`);
    this.distribute();

    switch (phase.kind) {
      case "investigation":
        this.startTurns(phase);
        break;
      case "final-statements":
        this.startStatements(phase);
        break;
      case "vote":
        this.votes.clear();
        this.state.voteRound = 1;
        this.state.runoffCandidates.clear();
        this.state.accusedCharacterId = "";
        for (const p of this.state.players.values()) p.hasVoted = false;
        break;
      case "objectives-review":
        this.openJury();
        this.computeResult();
        break;
      case "ending":
        this.computeResult(true);
        break;
    }

    this.broadcast("phase:changed", {
      phaseId: phase.id,
      kind: phase.kind,
      endsAt: this.state.phaseEndsAt || null,
    });
  }

  private onPhaseTimeout() {
    if (this.currentPhase()?.kind === "vote" && !this.state.accusedCharacterId) {
      this.resolveVote(false, true);
      return;
    }
    this.advancePhase();
  }

  /** 전원이 할 일을 마치면 타이머 전에 넘어간다 */
  private checkAllDone() {
    const phase = this.currentPhase();
    if (!phase) return;
    const endEarly = phase.endEarlyWhenAllDone || phase.kind === "character-select";
    if (!endEarly) return;
    const active = [...this.state.players.values()].filter((p) => p.connected);
    if (active.length > 0 && active.every((p) => p.done)) this.advancePhase();
  }

  private clearTimers() {
    this.phaseTimer?.clear();
    this.turnTimer?.clear();
    this.speakerTimer?.clear();
    this.phaseTimer = this.turnTimer = this.speakerTimer = undefined;
  }

  /* ───────── 캐릭터 배정 ───────── */

  /** 인물을 고르지 않은 참가자에게 남은 인물을 무작위로 배정하고 비밀 문서를 보낸다 */
  private finishCasting() {
    if (this.castingDone) return;
    const taken = new Set([...this.state.players.values()].map((p) => p.characterId));
    const left = shuffle(this.scenario.characters.map((c) => c.id).filter((id) => !taken.has(id)));
    for (const p of this.state.players.values()) {
      if (!p.characterId) p.characterId = left.shift() ?? "";
    }
    this.castingDone = true;
    this.sendScripts();
    this.distribute();
  }

  private sendScripts() {
    for (const client of this.clients) this.sendScript(client);
  }

  private sendScript(client: MysteryClient) {
    const characterId = this.state.players.get(client.sessionId)?.characterId;
    const character = this.scenario.characters.find((c) => c.id === characterId);
    if (!character || !this.castingDone) return;
    this.sendTo(client, "character:script", {
      characterId: character.id,
      script: character.script,
      objectives: character.objectives.map((o) => ({
        id: o.id,
        kind: o.kind,
        text: o.text,
        points: o.points,
        judge: o.judge.kind,
      })),
      isCulprit: character.isCulprit,
    });
  }

  /** 입장·재입장한 클라이언트에게 볼 수 있는 단서, 비밀 문서, 대화 기록을 다시 준다 */
  private restoreClient(client: MysteryClient) {
    const characterId = this.state.players.get(client.sessionId)?.characterId ?? "";
    for (const card of this.state.cards.values()) {
      if (card.isPublic || (characterId && this.owned.get(characterId)?.has(card.id))) {
        client.view?.add(this.clueState(card.id));
      }
    }
    this.sendScript(client);
    this.sendTo(
      client,
      "chat:history",
      this.chatLog.filter(
        (m) =>
          m.channel === "all" ||
          m.channel === "gm" ||
          (!!characterId &&
            (m.characterId === characterId || m.channel === `whisper:${characterId}`)),
      ),
    );
  }

  /* ───────── 단서 ───────── */

  private clueById(id: string) {
    return this.scenario.clues.find((c) => c.id === id);
  }

  private clueState(id: string): ClueState {
    let entry = this.state.clues.get(id);
    if (!entry) {
      const clue = this.clueById(id);
      entry = new ClueState({
        id,
        code: clue?.code ?? "",
        title: clue?.title ?? "",
        body: clue?.body ?? "",
        imageKey: clue?.imageKey ?? "",
        category: clue?.category ?? "physical",
        source: clue?.source ?? "",
      });
      this.state.clues.set(id, entry);
    }
    return entry;
  }

  private ensureCard(clue: Clue): ClueCard {
    let card = this.state.cards.get(clue.id);
    if (!card) {
      card = new ClueCard({
        id: clue.id,
        code: clue.code,
        category: clue.category,
        source: clue.source,
        locationId: clue.locationId ?? "",
        round: Math.max(1, currentRound(this.scenario, this.state.phaseIndex)),
      });
      this.state.cards.set(clue.id, card);
    }
    return card;
  }

  private giveClue(characterId: string, clue: Clue, from: "search" | "auto" | "given") {
    const set = (map: Map<string, Set<string>>) => {
      const s = map.get(characterId) ?? new Set<string>();
      map.set(characterId, s);
      return s;
    };
    set(this.owned).add(clue.id);
    set(this.collected).add(clue.id);
    const card = this.ensureCard(clue);
    card.holderId = characterId;
    const entry = this.clueState(clue.id);
    const client = this.clientByCharacter(characterId);
    if (!client) return;
    client.view?.add(entry);
    this.sendTo(client, "clue:acquired", { clue: toClueView(clue), from });
  }

  /**
   * 해금된 공통 자료를 공개하고, 자동 배포 단서를 대상에게 주고, 새로 열린 탐색 단서를 보드에 올린다.
   * 단서가 오갈 때마다 부른다. 연쇄 해금이 끝날 때까지 반복한다.
   */
  private distribute() {
    if (this.state.status !== "playing") return;
    for (let guard = 0; guard < 20; guard++) {
      let changed = false;
      const facts = this.facts();
      for (const clue of this.scenario.clues) {
        if (clue.distribution === "search" || !isUnlocked(clue, facts)) continue;
        if (clue.distribution === "public") {
          const card = this.ensureCard(clue);
          if (card.isPublic) continue;
          card.isPublic = true;
          const entry = this.clueState(clue.id);
          for (const c of this.clients) {
            c.view?.add(entry);
            this.sendTo(c, "clue:acquired", { clue: toClueView(clue), from: "public" });
          }
          this.announce(`공통 자료가 공개되었습니다 — ${clue.code} · ${clue.title}`);
          changed = true;
        } else if (this.castingDone) {
          for (const characterId of this.assignedCharacterIds()) {
            if (this.collected.get(characterId)?.has(clue.id) || !canSee(clue, characterId)) {
              continue;
            }
            this.giveClue(characterId, clue, "auto");
            changed = true;
          }
        }
      }
      for (const clue of boardClues(this.scenario, this.facts())) {
        if (!this.state.cards.has(clue.id)) {
          this.ensureCard(clue);
          changed = true;
        }
      }
      if (!changed) return;
    }
  }

  /** 이 캐릭터가 지금 보드에서 가져갈 수 있는 단서 */
  private availableFor(characterId: string): Clue[] {
    return boardClues(this.scenario, this.facts()).filter((c) => {
      const card = this.state.cards.get(c.id);
      return (!card || (!card.holderId && !card.isPublic)) && canSee(c, characterId);
    });
  }

  /* ───────── 탐색 차례 ───────── */

  private startTurns(phase: Extract<Phase, { kind: "investigation" }>) {
    const seats = this.assignedCharacterIds();
    const order = phase.turnOrder === "free" ? "seat" : phase.turnOrder;
    this.turnSeq = turnSequence(seats, phase.round, phase.pointsPerPlayer, order);
    this.turnIndex = -1;
    this.state.turnOrder.clear();
    for (const id of this.turnSeq) this.state.turnOrder.push(id);
    this.state.turnTotal = this.turnSeq.length;
    for (const p of this.state.players.values()) {
      p.picksLeft = p.characterId ? phase.pointsPerPlayer : 0;
    }
    this.nextTurn();
  }

  private turnSeconds() {
    const phase = this.currentPhase();
    const total = Math.max(1, this.turnSeq.length);
    const share = phase ? Math.floor((phase.durationSec * 0.9) / total) : TURN_SEC_MAX;
    return Math.min(TURN_SEC_MAX, Math.max(TURN_SEC_MIN, share || TURN_SEC_MAX));
  }

  private nextTurn(): void {
    this.turnTimer?.clear();
    this.turnIndex += 1;
    const characterId = this.turnSeq[this.turnIndex];
    if (!characterId || this.availableFor(characterId).length === 0) {
      // 모두 다 주웠거나 더 주울 단서가 없다
      const rest = this.turnSeq.slice(this.turnIndex);
      if (characterId && rest.some((id) => this.availableFor(id).length > 0)) {
        this.state.turnNumber = this.turnIndex + 1;
        this.nextTurn();
        return;
      }
      this.state.turnCharacterId = "";
      this.state.turnEndsAt = 0;
      this.state.turnNumber = this.turnSeq.length;
      for (const p of this.state.players.values()) p.done = true;
      this.announce("이번 라운드의 수집이 끝났습니다");
      if (this.currentPhase()?.endEarlyWhenAllDone) {
        this.turnTimer = this.clock.setTimeout(() => this.advancePhase(), 4000);
      }
      return;
    }
    const seconds = this.turnSeconds();
    this.state.turnCharacterId = characterId;
    this.state.turnNumber = this.turnIndex + 1;
    this.state.turnEndsAt = Date.now() + seconds * 1000;
    const connected = this.playerByCharacter(characterId)?.connected ?? false;
    this.turnTimer = this.clock.setTimeout(
      () => this.autoPick(),
      connected ? seconds * 1000 : 3000,
    );
  }

  /** 시간이 지나거나 자리를 비우면 무작위로 한 장 줍는다 */
  private autoPick() {
    const characterId = this.state.turnCharacterId;
    if (!characterId || this.currentPhase()?.kind !== "investigation") return;
    const options = this.availableFor(characterId);
    const clue = options[Math.floor(Math.random() * options.length)];
    if (clue) this.pick(characterId, clue, true);
    else this.nextTurn();
  }

  private pick(characterId: string, clue: Clue, auto = false) {
    this.giveClue(characterId, clue, "search");
    const player = this.playerByCharacter(characterId);
    if (player && player.picksLeft > 0) player.picksLeft -= 1;
    const place = this.scenario.locations.find((l) => l.id === clue.locationId)?.name ?? "";
    this.announce(
      `${josa(this.characterName(characterId), "이/가")} ${place}에서 ${josa(clue.code, "을/를")} ${auto ? "무작위로 " : ""}수집했습니다`,
    );
    this.distribute();
    this.nextTurn();
  }

  /* ───────── 최후 진술 ───────── */

  private startStatements(phase: Extract<Phase, { kind: "final-statements" }>) {
    const seats = this.assignedCharacterIds();
    const order = phase.order === "random" ? shuffle(seats) : seats;
    this.state.speakerOrder.clear();
    for (const id of order) this.state.speakerOrder.push(id);
    this.speakerIndex = -1;
    this.nextSpeaker();
  }

  private nextSpeaker() {
    const phase = this.currentPhase();
    if (phase?.kind !== "final-statements") return;
    this.speakerTimer?.clear();
    const previous = this.playerByCharacter(this.state.speakerCharacterId);
    if (previous) previous.done = true;
    this.speakerIndex += 1;
    const characterId = this.state.speakerOrder[this.speakerIndex];
    if (!characterId) {
      this.state.speakerCharacterId = "";
      this.state.speakerEndsAt = 0;
      this.announce("모든 진술이 끝났습니다. 곧 투표가 시작됩니다");
      this.speakerTimer = this.clock.setTimeout(() => this.advancePhase(), 4000);
      return;
    }
    this.state.speakerCharacterId = characterId;
    this.state.speakerSec = phase.perPlayerSec;
    this.state.speakerEndsAt = Date.now() + phase.perPlayerSec * 1000;
    this.speakerTimer = this.clock.setTimeout(() => this.nextSpeaker(), phase.perPlayerSec * 1000);
  }

  /* ───────── 투표 ───────── */

  private voteCandidates(): string[] {
    return this.state.runoffCandidates.length > 0
      ? [...this.state.runoffCandidates]
      : this.scenario.characters.map((c) => c.id);
  }

  /** 개표. 동표면 결선 투표(한 번), 그래도 동표면 미지목으로 끝낸다 */
  private resolveVote(force: boolean, timedOut = false) {
    const phase = this.currentPhase();
    if (phase?.kind !== "vote" || this.state.accusedCharacterId) return;
    const top = topVoted(this.votes.values());
    if (top.length > 1 && !force && phase.runoffSec > 0 && this.state.voteRound === 1) {
      this.state.voteRound = 2;
      this.state.runoffCandidates.clear();
      for (const id of top) this.state.runoffCandidates.push(id);
      this.votes.clear();
      for (const p of this.state.players.values()) p.hasVoted = false;
      this.phaseTimer?.clear();
      this.state.phaseEndsAt = Date.now() + phase.runoffSec * 1000;
      this.phaseTimer = this.clock.setTimeout(() => this.onPhaseTimeout(), phase.runoffSec * 1000);
      this.announce(
        `동표입니다. ${top.map((id) => this.characterName(id)).join(", ")} 중에서 결선 투표를 하십시오`,
      );
      return;
    }
    const accused = top.length === 1 ? top[0] : null;
    this.state.accusedCharacterId = accused ?? "none";
    this.announce(
      timedOut ? "투표 시간이 끝났습니다. 개표합니다" : "모든 표가 모였습니다. 개표합니다",
    );
    this.phaseTimer?.clear();
    this.phaseTimer = this.clock.setTimeout(() => this.advancePhase(), 2500);
  }

  /* ───────── 목표 결산·결말 ───────── */

  private openJury() {
    this.state.jury.clear();
    this.juryVotes.clear();
    for (const characterId of this.assignedCharacterIds()) {
      const character = this.scenario.characters.find((c) => c.id === characterId);
      for (const o of character?.objectives ?? []) {
        if (o.judge.kind === "auto") continue;
        this.state.jury.set(
          `${characterId}:${o.id}`,
          new JuryItem({ characterId, objectiveId: o.id, prompt: o.judge.prompt }),
        );
      }
    }
  }

  private juryVerdict(characterId: string, objectiveId: string, final: boolean) {
    const item = this.state.jury.get(`${characterId}:${objectiveId}`);
    if (!item) return final ? false : null;
    const jurors = Math.max(1, this.assignedCharacterIds().length - 1);
    if (item.yes * 2 > jurors) return true;
    if (item.no * 2 >= jurors) return false;
    if (!final) return null;
    return item.yes > item.no;
  }

  private computeResult(final = false) {
    const accusedId =
      this.state.accusedCharacterId && this.state.accusedCharacterId !== "none"
        ? this.state.accusedCharacterId
        : null;
    const facts: GameFacts = { ...this.facts(), accusedId };
    const ending = pickEnding(this.scenario, facts);
    this.state.endingId = ending.id;
    const holders = (clueId: string) =>
      [...this.owned].filter(([, set]) => set.has(clueId)).map(([id]) => id);
    const result: GameResult = {
      culpritId: this.scenario.characters.find((c) => c.isCulprit)?.id ?? "",
      accusedId,
      votes: Object.fromEntries(this.votes),
      ending: {
        id: ending.id,
        title: ending.title,
        body: renderEndingBody(this.scenario, ending, accusedId),
      },
      solution: this.scenario.solution,
      scores: this.assignedCharacterIds().map((characterId) => {
        const character = this.scenario.characters.find((c) => c.id === characterId);
        if (!character) throw new Error(`없는 인물: ${characterId}`);
        const score = scoreCharacter(this.scenario, character, facts, (objectiveId) =>
          this.juryVerdict(characterId, objectiveId, final),
        );
        return {
          characterId,
          culpritVote: score.culpritVote,
          total: score.total,
          objectives: score.objectives.map((o) => {
            const item = this.state.jury.get(`${characterId}:${o.id}`);
            return item
              ? { ...o, juryYes: item.yes, juryNo: item.no, juryVoters: [...item.voters] }
              : o;
          }),
        };
      }),
      clues: this.scenario.clues.map((c) => ({
        ...toClueView(c),
        holderIds: holders(c.id),
        isKey: c.isKey,
      })),
      secrets: this.scenario.characters.map((c) => ({
        characterId: c.id,
        text: c.script.sealedTruth.text,
      })),
    };
    this.state.result = JSON.stringify(result);
  }

  /* ───────── 도우미 ───────── */

  /** 조건 판정용 진행 상황 */
  private facts(): GameFacts {
    const publicClueIds = new Set<string>();
    for (const card of this.state.cards.values()) if (card.isPublic) publicClueIds.add(card.id);
    return {
      round: currentRound(this.scenario, this.state.phaseIndex),
      owned: this.owned,
      collected: this.collected,
      publicClueIds,
      votes: this.votes,
    };
  }

  /** 인물이 배정된 캐릭터 id (시나리오 순서 = 좌석 순서) */
  private assignedCharacterIds(): string[] {
    const assigned = new Set([...this.state.players.values()].map((p) => p.characterId));
    return this.scenario.characters.map((c) => c.id).filter((id) => assigned.has(id));
  }

  private assignedPlayers(): Player[] {
    return [...this.state.players.values()].filter((p) => p.characterId);
  }

  private playerByCharacter(characterId: string) {
    if (!characterId) return undefined;
    return [...this.state.players.values()].find((p) => p.characterId === characterId);
  }

  private clientByCharacter(characterId: string) {
    for (const [sessionId, p] of this.state.players) {
      if (p.characterId === characterId) return this.clients.getById(sessionId);
    }
    return undefined;
  }

  private characterName(characterId: string) {
    return this.scenario.characters.find((c) => c.id === characterId)?.name ?? "관전자";
  }

  private pushChat(message: ChatMessage) {
    this.chatLog.push(message);
    if (this.chatLog.length > MAX_CHAT_LOG) this.chatLog.shift();
  }

  /** GM 공지 (모두에게) */
  private announce(text: string) {
    const message: ChatMessage = {
      id: `${Date.now()}-gm-${this.chatLog.length}`,
      channel: "gm",
      fromSessionId: null,
      characterId: null,
      text,
      sentAt: Date.now(),
    };
    this.pushChat(message);
    this.broadcast("chat:message", message);
  }
}

function toClueView(clue: Clue): ClueView {
  return {
    id: clue.id,
    code: clue.code,
    title: clue.title,
    body: clue.body,
    imageKey: clue.imageKey,
    category: clue.category,
    source: clue.source,
  };
}
