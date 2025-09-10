import { defineConfig } from "drizzle-kit";
import { parseEnv } from "@/env";

// import env from "@/env-runtime";

const env = parseEnv(process.env as any);
console.log("env", env);

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "sqlite",
  driver: "d1-http",
  dbCredentials: {
    accountId: env.CF_ACCOUNT_ID,
    databaseId: env.CF_D1_DB_ID,
    token: env.CF_TOKEN_ID,
  },
});
