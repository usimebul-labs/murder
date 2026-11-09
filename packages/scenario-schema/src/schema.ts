import { z } from "zod";

/** 시나리오 JSON 형식의 버전. 형식이 바뀌면 올리고 migrate.ts에 변환을 추가한다. */
export const SCHEMA_VERSION = 2 as const;

const id = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-_]*$/, "소문자, 숫자, -, _ 만 사용할 수 있습니다");

/** 리치 텍스트는 우선 마크다운 문자열로 저장한다. (스튜디오에서 Tiptap으로 편집) */
const richText = z.string().max(20_000);
const shortText = z.string().max(200);
const clock = z.string().regex(/^\d{2}:\d{2}$/, "HH:MM 형식");

/* ───────────── 조건: 단서 해금·자동 배포, 목표 판정, 결말 분기에 같은 문법을 쓴다 ───────────── */

/**
 * by: "self" = 판정 대상 캐릭터 자신(목표 판정에서만 의미가 있음),
 *     "anyone" = 아무나(기본값), 그 밖의 값 = 캐릭터 id
 */
const actor = z.string().min(1).max(64);

export type Condition =
  | { kind: "always" }
  | { kind: "clue-collected"; clueId: string; by?: string }
  | { kind: "clue-public"; clueId: string }
  | { kind: "clue-held-by"; clueId: string; by: string }
  | { kind: "accused-is"; characterIds: string[] }
  | { kind: "no-accused" }
  | { kind: "voted-for"; characterIds: string[]; by?: string }
  | { kind: "all"; of: Condition[] }
  | { kind: "any"; of: Condition[] }
  | { kind: "not"; condition: Condition };

export const ConditionSchema: z.ZodType<Condition> = z.lazy(() =>
  z.discriminatedUnion("kind", [
    z.object({ kind: z.literal("always") }),
    z.object({ kind: z.literal("clue-collected"), clueId: id, by: actor.optional() }),
    z.object({ kind: z.literal("clue-public"), clueId: id }),
    z.object({ kind: z.literal("clue-held-by"), clueId: id, by: actor }),
    z.object({ kind: z.literal("accused-is"), characterIds: z.array(id).min(1) }),
    z.object({ kind: z.literal("no-accused") }),
    z.object({
      kind: z.literal("voted-for"),
      characterIds: z.array(id).min(1),
      by: actor.optional(),
    }),
    z.object({ kind: z.literal("all"), of: z.array(ConditionSchema).min(1) }),
    z.object({ kind: z.literal("any"), of: z.array(ConditionSchema).min(1) }),
    z.object({ kind: z.literal("not"), condition: ConditionSchema }),
  ]),
);

/* ───────────── 기본 정보 (L-01 카드, L-02 히어로) ───────────── */

export const ScenarioMetaSchema = z.object({
  title: z.string().min(1).max(80),
  /** 화면 표기용 사건 번호, 예: "01" → CASE 01 */
  caseNumber: z.string().max(8).optional(),
  /** 카드·배너의 한 줄 훅 */
  hook: z.string().max(120).default(""),
  synopsis: z.string().max(1000),
  setting: z.object({ year: z.number().int(), place: z.string().max(40) }).optional(),
  minPlayers: z.number().int().min(2).max(8),
  maxPlayers: z.number().int().min(2).max(8),
  estimatedMinutes: z.number().int().min(10).max(600),
  difficulty: z.enum(["easy", "normal", "hard"]),
  coverImageKey: z.string().optional(),
  tags: z.array(z.string().max(20)).max(10).default([]),
  contentWarnings: z.array(z.string().max(20)).max(10).default([]),
});

/** 프롤로그 I·II·III (L-02 문서 넘김, R-01 사건 정보, 오프닝 시퀀스) */
export const PrologueChapterSchema = z.object({
  id,
  title: z.string().max(20),
  body: richText,
});

/* ───────────── 장소 (G-03 저택 평면도) ───────────── */

export const LocationSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  description: z.string().max(500).optional(),
  /** 평면도 위 영역 (0~100 비율 좌표) */
  map: z.object({
    x: z.number().min(0).max(100),
    y: z.number().min(0).max(100),
    w: z.number().min(0).max(100),
    h: z.number().min(0).max(100),
  }),
  /** 이 라운드의 조사부터 열린다 */
  openFromRound: z.number().int().min(1).default(1),
});

/* ───────────── 캐릭터 (G-01 공개 프로필, G-02 비밀 문서, G-07 목표) ───────────── */

export const ObjectiveJudgeSchema = z.discriminatedUnion("kind", [
  /** 시스템이 게임 종료 시 조건으로 판정 (G-07 1안) */
  z.object({ kind: z.literal("auto"), condition: ConditionSchema }),
  /** 다른 참가자 과반 투표로 판정 (G-07 2안) */
  z.object({ kind: z.literal("jury"), prompt: shortText }),
  /** 사람 GM 판정 (P-07) */
  z.object({ kind: z.literal("gm"), prompt: shortText }),
]);

export const ObjectiveSchema = z.object({
  id,
  kind: z.enum(["main", "sub"]),
  text: shortText,
  points: z.number().int().min(0).max(10),
  judge: ObjectiveJudgeSchema,
});

export const CharacterScriptSchema = z.object({
  /** 01 당신은 누구인가 */
  identity: richText,
  /** 02 당신이 아는 사람들 */
  relationships: z.array(z.object({ characterId: id, text: shortText })).default([]),
  /** 03 그날 밤의 행적. secret이면 화면에 비밀 표시 */
  timeline: z
    .array(z.object({ time: clock, text: z.string().max(500), secret: z.boolean().default(false) }))
    .default([]),
  /** 04 봉인된 진실 */
  sealedTruth: z.object({
    text: richText,
    mustHide: z.array(shortText).default([]),
    mayReveal: z.array(shortText).default([]),
  }),
});

export const CharacterSchema = z.object({
  id,
  name: z.string().min(1).max(40),
  /** 역할 배지, 예: 장남, 변호사 */
  role: z.string().max(20).default(""),
  age: z.number().int().min(0).max(150).optional(),
  portraitKey: z.string().optional(),
  /** 카드 한 줄 */
  tagline: z.string().max(60).default(""),
  /** 모든 플레이어에게 보이는 소개 */
  publicProfile: richText,
  /** 프로필의 특징 (최대 3줄) */
  traits: z.array(z.string().max(40)).max(3).default([]),
  /** 이 캐릭터를 맡은 플레이어만 보는 비밀 문서 */
  script: CharacterScriptSchema,
  /** 05 목표. 주 목표 1개 + 보조 목표 0개 이상 */
  objectives: z.array(ObjectiveSchema).max(10).default([]),
  isCulprit: z.boolean().default(false),
  /** 디자인 시스템의 --char-1 ~ --char-8 */
  colorIndex: z.number().int().min(1).max(8),
});

/* ───────────── 단서 (G-03 수집, G-04 공개·건네기) ───────────── */

/** 이 단서를 얻을 수 있는 캐릭터 */
export const ClueVisibilitySchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("all") }),
  z.object({ kind: z.literal("characters"), characterIds: z.array(id).min(1) }),
]);

export const ClueUnlockSchema = z.object({
  /** 이 라운드부터 나타난다 */
  fromRound: z.number().int().min(1).default(1),
  /** 추가 조건. 만족해야 나타난다 */
  when: ConditionSchema.optional(),
});

export const ClueCategorySchema = z.enum(["physical", "document", "testimony", "hearsay"]);

export const ClueSchema = z.object({
  id,
  /** 화면 표기용 코드, 예: EV-07 */
  code: z.string().regex(/^[A-Z]{2,4}-[A-Z0-9]{1,3}$/),
  title: z.string().min(1).max(60),
  /** 다른 참가자에게도 보이는 앞면: 분류 + 출처 */
  category: ClueCategorySchema,
  source: z.string().max(40),
  /** 가진 사람만 보는 뒷면 */
  body: richText,
  /** Supabase Storage 객체 키 (비공개 버킷) */
  imageKey: z.string().optional(),
  /**
   * search = 장소(locationId)를 조사해 줍는다
   * public = 해금되는 순간 모두에게 공개된다 (공통 자료)
   * auto   = 해금되는 순간 visibility 대상 캐릭터에게 자동으로 주어진다
   */
  distribution: z.enum(["search", "public", "auto"]).default("search"),
  locationId: id.optional(),
  visibility: ClueVisibilitySchema.default({ kind: "all" }),
  unlock: ClueUnlockSchema.default({ fromRound: 1 }),
  /** 결말 재구성·검수용 표시. 게임 규칙에는 영향 없음 */
  isKey: z.boolean().default(false),
});

/* ───────────── 페이즈 (서버 상태 머신의 입력, 화면 하나에 대응) ───────────── */

const phaseBase = {
  id,
  title: z.string().min(1).max(40),
  /** 전환 타이틀 카드, 예: ROUND 02 · EXPLORE */
  titleCard: z.string().max(40).optional(),
  /** 0이면 시간 제한 없음 (호스트가 넘김) */
  durationSec: z
    .number()
    .int()
    .min(0)
    .max(60 * 60 * 3),
  /** 밀담(소그룹 음성·채팅) 허용 여부 */
  allowWhisper: z.boolean().default(false),
  /** 음성 채팅 사용 여부 (예: 투표 중 음소거) */
  voiceEnabled: z.boolean().default(true),
  /** 전원이 끝내면 타이머 전에 넘어간다 */
  endEarlyWhenAllDone: z.boolean().default(false),
};

export const PhaseSchema = z.discriminatedUnion("kind", [
  z.object({ ...phaseBase, kind: z.literal("intro") }),
  z.object({
    ...phaseBase,
    kind: z.literal("character-select"),
    mode: z.enum(["preference-draw", "random", "host-assign"]).default("preference-draw"),
  }),
  z.object({ ...phaseBase, kind: z.literal("reading") }),
  z.object({
    ...phaseBase,
    kind: z.literal("investigation"),
    round: z.number().int().min(1),
    /** 한 사람이 이 라운드에 수집할 수 있는 단서 수 */
    pointsPerPlayer: z.number().int().min(1).max(10),
    /** seat-rotating = 좌석 순서, 라운드마다 시작 순번이 한 칸씩 밀림 */
    turnOrder: z.enum(["seat-rotating", "seat", "random", "free"]).default("seat-rotating"),
  }),
  z.object({
    ...phaseBase,
    kind: z.literal("discussion"),
    round: z.number().int().min(1),
    allowReveal: z.boolean().default(true),
    allowHandOver: z.boolean().default(true),
    whisper: z
      .object({
        maxParticipants: z.number().int().min(2).max(3),
        maxDurationSec: z.number().int().min(30),
        maxPerPlayer: z.number().int().min(1),
      })
      .optional(),
  }),
  z.object({
    ...phaseBase,
    kind: z.literal("final-statements"),
    perPlayerSec: z.number().int().min(10),
    order: z.enum(["seat", "random"]).default("seat"),
    maxPinnedClues: z.number().int().min(0).max(10).default(3),
  }),
  z.object({
    ...phaseBase,
    kind: z.literal("vote"),
    allowSelfVote: z.boolean().default(true),
    /** 동표 시 재투표 시간. 0이면 재투표 없이 미지목 */
    runoffSec: z.number().int().min(0).default(0),
  }),
  z.object({
    ...phaseBase,
    kind: z.literal("objectives-review"),
    revealIntervalSec: z.number().int().min(0).default(3),
  }),
  z.object({ ...phaseBase, kind: z.literal("ending"), mvpVote: z.boolean().default(true) }),
]);

/* ───────────── 정답·결말 (G-08) ───────────── */

export const SolutionSchema = z.object({
  motive: richText,
  method: richText,
  /** 03 그날 밤: 시간순 재구성 */
  timeline: z
    .array(
      z.object({
        time: clock,
        locationId: id.optional(),
        text: z.string().max(500),
        clueIds: z.array(id).default([]),
      }),
    )
    .default([]),
  keyClueIds: z.array(id).default([]),
});

export const EndingSchema = z.object({
  id,
  title: z.string().min(1).max(60),
  /** {accused} = 지목된 캐릭터 이름 */
  body: richText,
  /** 위에서부터 처음 만족하는 결말을 고른다. 마지막은 { kind: "always" } */
  condition: ConditionSchema,
});

export const ScoringSchema = z.object({
  /** 진범에게 투표한 사람이 받는 점수 (진범 본인 제외) */
  culpritVotePoints: z.number().int().min(0).max(10).default(1),
});

/* ───────────── 시나리오 ───────────── */

export const ScenarioSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  id,
  meta: ScenarioMetaSchema,
  prologue: z.array(PrologueChapterSchema).max(10).default([]),
  rules: z.array(z.string().max(300)).max(20).default([]),
  victim: z.object({ name: z.string().max(40), description: z.string().max(500) }).optional(),
  locations: z.array(LocationSchema).max(30).default([]),
  characters: z.array(CharacterSchema).min(2).max(8),
  clues: z.array(ClueSchema).max(300),
  phases: z.array(PhaseSchema).min(2).max(50),
  scoring: ScoringSchema.default({ culpritVotePoints: 1 }),
  solution: SolutionSchema.optional(),
  endings: z.array(EndingSchema).min(1).max(20),
});

export type ScenarioMeta = z.infer<typeof ScenarioMetaSchema>;
export type PrologueChapter = z.infer<typeof PrologueChapterSchema>;
export type Location = z.infer<typeof LocationSchema>;
export type ObjectiveJudge = z.infer<typeof ObjectiveJudgeSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type CharacterScript = z.infer<typeof CharacterScriptSchema>;
export type Character = z.infer<typeof CharacterSchema>;
export type ClueVisibility = z.infer<typeof ClueVisibilitySchema>;
export type ClueUnlock = z.infer<typeof ClueUnlockSchema>;
export type ClueCategory = z.infer<typeof ClueCategorySchema>;
export type Clue = z.infer<typeof ClueSchema>;
export type Phase = z.infer<typeof PhaseSchema>;
export type PhaseKind = Phase["kind"];
export type Solution = z.infer<typeof SolutionSchema>;
export type Ending = z.infer<typeof EndingSchema>;
export type Scenario = z.infer<typeof ScenarioSchema>;
/** 스키마 파싱 전 입력 형태 (기본값이 채워지기 전) */
export type ScenarioInput = z.input<typeof ScenarioSchema>;
