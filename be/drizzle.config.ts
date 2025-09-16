import { defineConfig } from "drizzle-kit";
import { DB_URL } from "@/constants/db-const";

export default defineConfig({
  schema: "./src/db/schema/*.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: DB_URL,
  },
  casing: "snake_case",
  verbose: true,
});
