import { z } from "zod";

/** 시나리오 JSON 형식의 버전. 형식이 바뀌면 올리고 migrate.ts에 변환을 추가한다. */
export const SCHEMA_VERSION = 1 as const;

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-_]*$/, "소문자, 숫자, -, _ 만 사용할 수 있습니다");

/** 리치 텍스트는 우선 마크다운 문자열로 저장한다. (스튜디오에서 Tiptap으로 편집) */
const richText = z.string().max(20_000);

export const CharacterSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  /** 모든 플레이어에게 보이는 소개 */
  publicProfile: richText,
  /** 이 캐릭터를 맡은 플레이어만 보는 개인 대본 */
  privateScript: richText,
  goals: z.array(z.string().max(200)).max(10).default([]),
  isCulprit: z.boolean().default(false),
  /** 디자인 시스템의 --char-1 ~ --char-8 */
  colorIndex: z.number().int().min(1).max(8),
});

export const ClueVisibilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("characters"), characterIds: z.array(id).min(1) }),
]);

export const ClueUnlockSchema = z.object({
  /** 이 페이즈가 시작되면 공개 */
  phaseId: id.optional(),
  /** 이 단서들을 모두 얻어야 공개 */
  requiresClueIds: z.array(id).default([]),
  /** 조사 포인트(장소) 이름. 있으면 해당 장소를 조사해야 획득 */
  location: z.string().max(40).optional(),
});

export const ClueSchema = z.object({
  id,
  /** 화면 표기용 코드, 예: EV-07 */
  code: z.string().regex(/^[A-Z]{2,4}-\d{2,3}$/),
  title: z.string().min(1).max(60),
  body: richText,
  /** Supabase Storage 객체 키 (비공개 버킷) */
  imageKey: z.string().optional(),
  visibility: ClueVisibilitySchema,
  unlock: ClueUnlockSchema.default({ requiresClueIds: [] }),
});

export const PhaseKindSchema = z.enum([
  "intro",
  "reading",
  "investigation",
  "discussion",
  "whisper",
  "vote",
  "ending",
]);

export const PhaseSchema = z.object({
  id,
  kind: PhaseKindSchema,
  title: z.string().min(1).max(40),
  /** 0이면 시간 제한 없음 (호스트가 넘김) */
  durationSec: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 3),
  /** 밀담(1:1 음성·채팅) 허용 여부 */
  allowWhisper: z.boolean().default(false),
  /** 음성 채팅 사용 여부 (예: 투표 중 음소거) */
  voiceEnabled: z.boolean().default(true),
});

export const EndingConditionSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("culprit-accused") }),
  z.object({ kind: z.literal("culprit-missed") }),
  z.object({ kind: z.literal("default") }),
]);

export const EndingSchema = z.object({
  id,
  title: z.string().min(1).max(60),
  body: richText,
  condition: EndingConditionSchema,
});

export const ScenarioMetaSchema = z.object({
  title: z.string().min(1).max(80),
  synopsis: z.string().max(1000),
  minPlayers: z.number().int().min(2).max(8),
  maxPlayers: z.number().int().min(2).max(8),
  estimatedMinutes: z.number().int().min(10).max(600),
  difficulty: z.enum(["easy", "normal", "hard"]),
  coverImageKey: z.string().optional(),
  tags: z.array(z.string().max(20)).max(10).default([]),
});

export const ScenarioSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  meta: ScenarioMetaSchema,
  characters: z.array(CharacterSchema).min(2).max(8),
  clues: z.array(ClueSchema).max(300),
  phases: z.array(PhaseSchema).min(2).max(50),
  endings: z.array(EndingSchema).min(1).max(20),
});

export type Character = z.infer<typeof CharacterSchema>;
export type ClueVisibility = z.infer<typeof ClueVisibilitySchema>;
export type ClueUnlock = z.infer<typeof ClueUnlockSchema>;
export type Clue = z.infer<typeof ClueSchema>;
export type PhaseKind = z.infer<typeof PhaseKindSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type EndingCondition = z.infer<typeof EndingConditionSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type ScenarioMeta = z.infer<typeof ScenarioMetaSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
/** 스키마 파싱 전 입력 형태 (기본값이 채워지기 전) */
export type ScenarioInput = z.input<typeof ScenarioSchema>;
