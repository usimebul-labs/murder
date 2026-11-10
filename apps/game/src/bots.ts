/**
 * 테스트 방의 AI 봇 참가자. 혼자서도 사건을 끝까지 진행해 볼 수 있도록
 * 빈 자리를 채우고, 진행에 필요한 행동(숙지 완료, 단서 수집, 진술, 투표, 판정)만 자동으로 한다.
 */

/** 봇이 자기 차례에 단서를 줍거나 투표하기까지 기다리는 시간 */
export const BOT_ACTION_MS = 1500;
/** 봇의 최후 진술 시간 (사람보다 짧게 끝낸다) */
export const BOT_STATEMENT_MS = 3000;

const BOT_KEY_PREFIX = "bot-";

/** 봇 자리의 플레이어 키. 실제 세션 id와 겹치지 않는다 */
export function botKey(n: number) {
  return `${BOT_KEY_PREFIX}${n}`;
}

export function botNickname(n: number) {
  return `AI 봇 ${n}`;
}

export function pickRandom<T>(items: readonly T[], random: () => number = Math.random) {
  return items.length > 0 ? items[Math.floor(random() * items.length)] : undefined;
}

/** 봇이 지목할 인물. 자기 지목이 막혀 있으면 자신은 뺀다 */
export function botVoteTarget(
  candidates: readonly string[],
  self: string,
  allowSelfVote: boolean,
  random: () => number = Math.random,
) {
  const options = allowSelfVote ? candidates : candidates.filter((id) => id !== self);
  return pickRandom(options, random);
}

/** 판정단 목표에 대한 봇의 판정 (반반) */
export function botJudgement(random: () => number = Math.random) {
  return random() < 0.5;
}

export const BOT_STATEMENT = "*잠시 침묵한 뒤* 저는 결백합니다. 판단은 여러분께 맡기겠습니다.";
