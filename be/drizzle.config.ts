import { defineConfig } from "drizzle-kit";
import { DB_URL } from "./src/constants/db-const";

// Here relative path because drizzle run before typescript

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
