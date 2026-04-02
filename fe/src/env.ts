// src/env.ts
import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.coerce.number().default(8787),
    LOG_LEVEL: z.enum([
      "fatal",
      "error",
      "warn",
      "info",
      "debug",
      "trace",
      "silent",
    ]),

    // Database
    DB_HOST: z.string().default("localhost"),
    DB_URL: z.url().optional(),
    DB_NAME: z.string(),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_PORT: z.coerce.number().default(5432),

    // Auth
    BETTER_AUTH_SECRET: z.string(),
    // BETTER_AUTH_URL: z.string(),

    // BE
    BE_URL: z.url(),

    // Email
    EMAIL_FROM: z.string(),
  },

  client: {
    NEXT_PUBLIC_API_URL: z.url(),
    NEXT_PUBLIC_APP_URL: z.url(),
  },

  runtimeEnv: {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
		LOG_LEVEL: process.env.LOG_LEVEL,
    BE_URL: process.env.BE_URL,
    DB_HOST: process.env.DB_HOST,
    DB_URL: process.env.DB_URL,
    DB_NAME: process.env.DB_NAME,
    DB_USER: process.env.DB_USER,
    DB_PASSWORD: process.env.DB_PASSWORD,
    DB_PORT: process.env.DB_PORT,
    BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
    // BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
    EMAIL_FROM: process.env.EMAIL_FROM,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },

  // Skip validation on edge (optional, for Cloudflare Workers)
  skipValidation: process.env.SKIP_ENV_VALIDATION === "true",

  // Empty string → undefined coercion (avoids "")
  emptyStringAsUndefined: true,
});
