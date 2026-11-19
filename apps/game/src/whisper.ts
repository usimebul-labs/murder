/**
 * 토론 중 밀담(비공개 소그룹 채팅).
 * 방장이 상대를 초대하고, 초대받은 사람이 수락하면 밀담이 열린다.
 * 한 사람은 한 번에 한 밀담에만 들어가 있을 수 있고, 밀담은 본인 포함 최대 3인이다.
 * 이 모듈은 규칙과 기록만 다루고, 상태 동기화·메시지 전송·타이머는 방이 맡는다.
 */

/** 밀담 인원 상한 (본인 포함). 시나리오 설정이 더 크더라도 이 값을 넘지 않는다 */
export const MAX_WHISPER_PARTICIPANTS = 3;
/** 초대에 답하지 않으면 이 시간 뒤 거절한 것으로 본다 */
export const WHISPER_INVITE_SEC = 30;

export interface WhisperLimits {
  /** 본인 포함 최대 인원 (2~3) */
  maxParticipants: number;
  /** 열린 뒤 이 시간이 지나면 끝난다. 0이면 페이즈가 끝날 때까지 */
  maxDurationSec: number;
  /** 한 사람이 이 페이즈에 열 수 있는 밀담 수. 0이면 제한 없음 */
  maxPerPlayer: number;
}

/** 시나리오의 토론 페이즈 밀담 설정을 규칙 값으로 바꾼다 */
export function whisperLimits(config?: {
  maxParticipants?: number;
  maxDurationSec?: number;
  maxPerPlayer?: number;
}): WhisperLimits {
  return {
    maxParticipants: Math.max(
      2,
      Math.min(MAX_WHISPER_PARTICIPANTS, config?.maxParticipants ?? MAX_WHISPER_PARTICIPANTS),
    ),
    maxDurationSec: config?.maxDurationSec ?? 0,
    maxPerPlayer: config?.maxPerPlayer ?? 0,
  };
}

export interface WhisperRecord {
  id: string;
  /** 처음 초대를 보낸 인물 */
  hostId: string;
  /** 들어와 있는 인물 (초대를 보낸 사람 포함) */
  members: string[];
  /** 아직 답하지 않은 초대 */
  invited: string[];
  /** 두 명 이상 모여 열린 시각 (epoch ms). 0이면 아직 수락한 사람이 없다 */
  startedAt: number;
  /** 0이면 페이즈가 끝날 때까지 */
  endsAt: number;
}

export type WhisperResult<T> = { ok: true; value: T } | { ok: false; error: string };

const fail = (error: string) => ({ ok: false, error }) as const;
const ok = <T>(value: T) => ({ ok: true, value }) as const;

export class WhisperBook {
  readonly whispers = new Map<string, WhisperRecord>();
  /** 인물 id → 이 페이즈에 연 밀담 수 */
  private opened = new Map<string, number>();
  private seq = 0;

  constructor(
    public limits: WhisperLimits,
    private now: () => number = Date.now,
  ) {}

  /** 페이즈가 바뀌면 모든 밀담을 끝내고 횟수를 새로 센다 */
  reset(limits: WhisperLimits) {
    const ended = [...this.whispers.values()];
    this.whispers.clear();
    this.opened.clear();
    this.limits = limits;
    return ended;
  }

  /** 이 인물이 들어가 있는 밀담 (열리기 전 자기가 초대만 보낸 것 포함) */
  memberOf(characterId: string) {
    for (const w of this.whispers.values()) if (w.members.includes(characterId)) return w;
    return undefined;
  }

  /** 이 인물이 받은 초대 */
  invitesFor(characterId: string) {
    return [...this.whispers.values()].filter((w) => w.invited.includes(characterId));
  }

  /** 이 인물과 관련된 모든 밀담 (들어가 있거나 초대받은 것) */
  involving(characterId: string) {
    return [...this.whispers.values()].filter(
      (w) => w.members.includes(characterId) || w.invited.includes(characterId),
    );
  }

  openedBy(characterId: string) {
    return this.opened.get(characterId) ?? 0;
  }

  /**
   * 초대를 보낸다. whisperId가 없으면 새 밀담을 만들고, 있으면 그 밀담에 사람을 더 부른다.
   * seated: 인물이 배정된 캐릭터 id
   */
  invite(
    from: string,
    targets: readonly string[],
    seated: readonly string[],
    whisperId?: string,
  ): WhisperResult<{ whisper: WhisperRecord; added: string[]; created: boolean }> {
    const wanted = [...new Set(targets)].filter((id) => id !== from);
    if (wanted.length === 0) return fail("밀담할 상대를 고르십시오");
    if (wanted.some((id) => !seated.includes(id))) return fail("밀담할 수 없는 상대입니다");

    const current = this.memberOf(from);
    let whisper: WhisperRecord;
    let created = false;
    if (whisperId) {
      const target = this.whispers.get(whisperId);
      if (!target?.members.includes(from)) return fail("들어가 있지 않은 밀담입니다");
      whisper = target;
    } else {
      if (current) return fail("이미 밀담 중입니다. 지금 밀담에서 나온 뒤 다시 신청하십시오");
      const { maxPerPlayer } = this.limits;
      if (maxPerPlayer > 0 && this.openedBy(from) >= maxPerPlayer) {
        return fail(`이번 토론에서는 밀담을 ${maxPerPlayer}번까지 신청할 수 있습니다`);
      }
      whisper = {
        id: `w${++this.seq}`,
        hostId: from,
        members: [from],
        invited: [],
        startedAt: 0,
        endsAt: 0,
      };
      created = true;
    }

    const fresh = wanted.filter(
      (id) => !whisper.members.includes(id) && !whisper.invited.includes(id),
    );
    if (fresh.length === 0) return fail("이미 초대한 상대입니다");
    const busy = fresh.find((id) => {
      const w = this.memberOf(id);
      return w && w.startedAt > 0;
    });
    if (busy) return fail("다른 밀담 중인 상대는 초대할 수 없습니다");
    if (
      whisper.members.length + whisper.invited.length + fresh.length >
      this.limits.maxParticipants
    ) {
      return fail(`밀담은 본인 포함 ${this.limits.maxParticipants}명까지 할 수 있습니다`);
    }

    whisper.invited.push(...fresh);
    if (created) this.whispers.set(whisper.id, whisper);
    return ok({ whisper, added: fresh, created });
  }

  /**
   * 초대에 답한다. 수락하면 들어가 있던 다른 밀담(초대만 보내 둔 것 포함)에서는 나온다.
   * started: 이 수락으로 밀담이 처음 열렸는지. left: 수락하면서 나온 밀담
   */
  respond(
    characterId: string,
    whisperId: string,
    accept: boolean,
  ): WhisperResult<{
    whisper: WhisperRecord;
    started: boolean;
    ended: boolean;
    left?: { whisper: WhisperRecord; ended: boolean };
  }> {
    const whisper = this.whispers.get(whisperId);
    if (!whisper?.invited.includes(characterId)) return fail("이미 끝난 초대입니다");
    whisper.invited = whisper.invited.filter((id) => id !== characterId);
    if (!accept) return ok({ whisper, started: false, ended: this.closeIfEmpty(whisper) });

    let left: { whisper: WhisperRecord; ended: boolean } | undefined;
    const previous = this.memberOf(characterId);
    if (previous) {
      const result = this.leave(characterId, previous.id);
      if (result.ok) left = result.value;
    }
    whisper.members.push(characterId);
    let started = false;
    if (whisper.startedAt === 0 && whisper.members.length >= 2) {
      started = true;
      const now = this.now();
      whisper.startedAt = now;
      whisper.endsAt = this.limits.maxDurationSec > 0 ? now + this.limits.maxDurationSec * 1000 : 0;
      this.opened.set(whisper.hostId, this.openedBy(whisper.hostId) + 1);
    }
    return ok({ whisper, started, ended: false, left });
  }

  /** 밀담에서 나온다. 남은 사람이 혼자고 기다리는 초대도 없으면 끝난다 */
  leave(
    characterId: string,
    whisperId: string,
  ): WhisperResult<{ whisper: WhisperRecord; ended: boolean }> {
    const whisper = this.whispers.get(whisperId);
    if (!whisper?.members.includes(characterId)) {
      return fail("들어가 있지 않은 밀담입니다");
    }
    whisper.members = whisper.members.filter((id) => id !== characterId);
    return ok({ whisper, ended: this.closeIfEmpty(whisper) });
  }

  /** 시간이 다 된 밀담을 끝낸다 */
  end(whisperId: string) {
    const whisper = this.whispers.get(whisperId);
    if (whisper) this.whispers.delete(whisperId);
    return whisper;
  }

  /** 대화할 사람이 남지 않았으면 지운다. 열린 뒤에는 둘 이상, 열리기 전에는 답을 기다리는 초대가 있어야 이어진다 */
  private closeIfEmpty(whisper: WhisperRecord) {
    const alive =
      whisper.members.length >= 2 || (whisper.members.length === 1 && whisper.invited.length > 0);
    if (alive) return false;
    this.whispers.delete(whisper.id);
    return true;
  }
}
