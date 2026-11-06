import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/murder",
  },
  // Supabase가 관리하는 auth 스키마는 건드리지 않는다
  schemaFilter: ["public"],
});
