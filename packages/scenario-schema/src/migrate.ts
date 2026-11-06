import { SCHEMA_VERSION } from "./schema.js";

/** 버전 N → N+1 변환 함수 목록. 형식을 바꿀 때 여기에 추가한다. */
const migrations: Record<number, (raw: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: (raw) => ({ ...raw, schemaVersion: 2, ... }),
};

/** 저장된 시나리오 JSON을 현재 SCHEMA_VERSION 형식으로 올린다. */
export function migrateScenario(raw: unknown): unknown {
  if (typeof raw !== "object" || raw === null) return raw;
  let doc = raw as Record<string, unknown>;
  let version = typeof doc.schemaVersion === "number" ? doc.schemaVersion : 1;
  if (version > SCHEMA_VERSION) {
    throw new Error(
      `지원하지 않는 시나리오 버전입니다 (${version} > ${SCHEMA_VERSION}). 서버를 업데이트하세요.`,
    );
  }
  while (version < SCHEMA_VERSION) {
    const step = migrations[version];
    if (!step) throw new Error(`시나리오 마이그레이션이 없습니다: v${version}`);
    doc = step(doc);
    version += 1;
  }
  return doc;
}
