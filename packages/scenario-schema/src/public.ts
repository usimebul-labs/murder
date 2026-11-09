import type { Scenario } from "./schema.js";

/**
 * 게임 시작 전(L-01·L-02·R-01·G-01) 클라이언트에 보내도 되는 부분만 남긴다.
 * 비밀 문서, 목표, 단서, 범인 여부, 정답, 결말은 빠진다.
 */
export function toPublicScenario(s: Scenario) {
  return {
    schemaVersion: s.schemaVersion,
    id: s.id,
    meta: s.meta,
    prologue: s.prologue,
    rules: s.rules,
    victim: s.victim,
    locations: s.locations.map(({ id, name, description, map, openFromRound }) => ({
      id,
      name,
      description,
      map,
      openFromRound,
    })),
    characters: s.characters.map(
      ({ id, name, role, age, portraitKey, tagline, publicProfile, traits, colorIndex }) => ({
        id,
        name,
        role,
        age,
        portraitKey,
        tagline,
        publicProfile,
        traits,
        colorIndex,
      }),
    ),
    phases: s.phases.map(({ id, kind, title, titleCard, durationSec }) => ({
      id,
      kind,
      title,
      titleCard,
      durationSec,
    })),
  };
}

export type PublicScenario = ReturnType<typeof toPublicScenario>;
