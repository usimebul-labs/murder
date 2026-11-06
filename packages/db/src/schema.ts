import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

/* ───────── 사용자 (Supabase auth.users와 1:1) ───────── */

export const userRole = pgEnum("user_role", ["player", "author", "admin"]);

export const profiles = pgTable("profiles", {
  /** auth.users.id */
  id: uuid("id").primaryKey(),
  nickname: text("nickname").notNull(),
  avatarUrl: text("avatar_url"),
  role: userRole("role").notNull().default("player"),
  /** 비공개 데모 접근 허용 여부 (초대 코드로 승인) */
  demoAccess: boolean("demo_access").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const inviteCodes = pgTable("invite_codes", {
  code: text("code").primaryKey(),
  maxUses: integer("max_uses").notNull().default(1),
  usedCount: integer("used_count").notNull().default(0),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: createdAt(),
});

/* ───────── 시나리오 (스튜디오가 쓰고, 게임은 발행본만 읽는다) ───────── */

export const scenarios = pgTable("scenarios", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** 시나리오 JSON의 id (사람이 읽는 슬러그) */
  slug: text("slug").notNull().unique(),
  authorId: uuid("author_id")
    .notNull()
    .references(() => profiles.id),
  /** 목록 노출용으로 복사해 두는 메타데이터 (본문은 versions에만) */
  title: text("title").notNull(),
  latestVersionId: uuid("latest_version_id"),
  listed: boolean("listed").notNull().default(false),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

/** 스튜디오 전용: 편집 중인 초안. 게임 서버는 읽지 않는다. */
export const scenarioDrafts = pgTable("scenario_drafts", {
  scenarioId: uuid("scenario_id")
    .primaryKey()
    .references(() => scenarios.id, { onDelete: "cascade" }),
  /** 검증 전일 수 있는 시나리오 JSON */
  document: jsonb("document").notNull(),
  updatedBy: uuid("updated_by").references(() => profiles.id),
  updatedAt: updatedAt(),
});

export const scenarioVersionKind = pgEnum("scenario_version_kind", ["published", "preview"]);

/**
 * 스튜디오 ↔ 게임 플레이의 유일한 계약.
 * validateScenario()를 통과한 JSON만 저장하며, 저장 후에는 수정하지 않는다(불변).
 */
export const scenarioVersions = pgTable(
  "scenario_versions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    scenarioId: uuid("scenario_id")
      .notNull()
      .references(() => scenarios.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    kind: scenarioVersionKind("kind").notNull().default("published"),
    schemaVersion: integer("schema_version").notNull(),
    document: jsonb("document").notNull(),
    publishedBy: uuid("published_by").references(() => profiles.id),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("scenario_versions_scenario_version_idx").on(t.scenarioId, t.version)],
);

/* ───────── 게임 기록 (게임 플레이 전용) ───────── */

export const gameStatus = pgEnum("game_status", ["playing", "finished", "aborted"]);

export const games = pgTable("games", {
  id: uuid("id").primaryKey().defaultRandom(),
  /** Colyseus roomId */
  roomId: text("room_id").notNull(),
  scenarioVersionId: uuid("scenario_version_id")
    .notNull()
    .references(() => scenarioVersions.id),
  hostId: uuid("host_id")
    .notNull()
    .references(() => profiles.id),
  status: gameStatus("status").notNull().default("playing"),
  endingId: text("ending_id"),
  startedAt: createdAt(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
});

export const gameParticipants = pgTable(
  "game_participants",
  {
    gameId: uuid("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => profiles.id),
    characterId: text("character_id").notNull(),
    votedCharacterId: text("voted_character_id"),
  },
  (t) => [primaryKey({ columns: [t.gameId, t.userId] })],
);

/** 게임 종료 후 저장하는 채팅 기록 (사건 기록 다시보기) */
export const gameChatLogs = pgTable("game_chat_logs", {
  gameId: uuid("game_id")
    .primaryKey()
    .references(() => games.id, { onDelete: "cascade" }),
  messages: jsonb("messages").notNull().default(sql`'[]'::jsonb`),
  createdAt: createdAt(),
});

/* ───────── 결제 (추후 연결, 스키마는 지금 확정) ───────── */

export const productKind = pgEnum("product_kind", ["scenario", "bundle", "pass"]);

export const products = pgTable("products", {
  id: text("id").primaryKey(),
  kind: productKind("kind").notNull(),
  title: text("title").notNull(),
  priceKrw: integer("price_krw").notNull(),
  /** kind=scenario일 때 대상 */
  scenarioId: uuid("scenario_id").references(() => scenarios.id),
  /** 이용 기간(일). null이면 영구 */
  durationDays: integer("duration_days"),
  appleProductId: text("apple_product_id"),
  googleProductId: text("google_product_id"),
  active: boolean("active").notNull().default(true),
  createdAt: createdAt(),
});

export const orderStatus = pgEnum("order_status", [
  "pending",
  "paid",
  "failed",
  "cancelled",
  "refunded",
]);

export const orders = pgTable("orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  amountKrw: integer("amount_krw").notNull(),
  status: orderStatus("status").notNull().default("pending"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const paymentProvider = pgEnum("payment_provider", ["manual", "portone", "revenuecat"]);

export const payments = pgTable(
  "payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orderId: uuid("order_id")
      .notNull()
      .references(() => orders.id),
    provider: paymentProvider("provider").notNull(),
    providerTxId: text("provider_tx_id").notNull(),
    status: orderStatus("status").notNull(),
    /** 웹훅 원문 (감사·분쟁 대응용) */
    raw: jsonb("raw"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("payments_provider_tx_idx").on(t.provider, t.providerTxId)],
);

export const entitlementSource = pgEnum("entitlement_source", ["purchase", "admin", "promotion"]);

/** 게임 서버·스튜디오가 확인하는 유일한 결제 결과 */
export const entitlements = pgTable("entitlements", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => profiles.id),
  productId: text("product_id")
    .notNull()
    .references(() => products.id),
  source: entitlementSource("source").notNull(),
  paymentId: uuid("payment_id").references(() => payments.id),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: createdAt(),
});
