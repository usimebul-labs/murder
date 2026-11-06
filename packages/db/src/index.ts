import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.js";

export * as schema from "./schema.js";

export function createDb(databaseUrl: string) {
  // Supabase 트랜잭션 풀러(6543)는 prepared statement를 지원하지 않는다
  const client = postgres(databaseUrl, { prepare: false });
  return drizzle(client, { schema });
}

export type Db = ReturnType<typeof createDb>;
