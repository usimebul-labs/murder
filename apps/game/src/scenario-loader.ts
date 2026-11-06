import { createDb, schema } from "@mm/db";
import {
  migrateScenario,
  type Scenario,
  sampleScenario,
  validateScenario,
} from "@mm/scenario-schema";
import { eq } from "drizzle-orm";
import { config } from "./config.js";

const db = config.databaseUrl ? createDb(config.databaseUrl) : null;

/**
 * 발행된 시나리오 버전(scenario_versions)을 불러온다.
 * 게임 서버는 스튜디오 코드에 의존하지 않고, 이 테이블과 스키마 패키지만 사용한다.
 */
export async function loadScenario(scenarioVersionId: string): Promise<Scenario> {
  let raw: unknown;
  if (scenarioVersionId === "sample" || !db) {
    raw = sampleScenario;
  } else {
    const [row] = await db
      .select({ document: schema.scenarioVersions.document })
      .from(schema.scenarioVersions)
      .where(eq(schema.scenarioVersions.id, scenarioVersionId))
      .limit(1);
    if (!row) throw new Error(`시나리오 버전을 찾을 수 없습니다: ${scenarioVersionId}`);
    raw = row.document;
  }
  const result = validateScenario(migrateScenario(raw));
  if (!result.ok) {
    throw new Error(`시나리오 검증 실패: ${result.issues.map((i) => i.message).join(", ")}`);
  }
  return result.scenario;
}
