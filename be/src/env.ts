// biome-ignore-all lint/style/noProcessEnv: Only place to run
import path from "node:path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

expand(
  config({
    path: path.resolve(
      process.cwd(),
      process.env.NODE_ENV === "test" ? ".env.test" : ".env"
    ),
  })
);

const EnvSchema = z
  .object({
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
    LOCAL_APP: z.string(),
    PROD_APP: z.string(),
    DB_HOST: z.string().default("localhost"),
    DB_URL: z.url(),
    DB_NAME: z.string(),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    DB_PORT: z.coerce.number().default(5432),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string(),
    // Socials Providers
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    EMAIL_FROM: z.string(),
  })
  .superRefine((input, ctx) => {
    if (input.NODE_ENV === "production") {
      if (!input.DB_URL) {
        if (!input.DB_PASSWORD) {
          ctx.addIssue({
            code: "custom",
            received: "undefined",
            path: ["DB_PASSWORD"],
            message: "DB_PASSWORD is required in production",
          });
          if (!input.DB_HOST || input.DB_HOST === "localhost") {
            ctx.addIssue({
              code: "custom",
              path: ["DB_HOST"],
              message:
                "DB_HOST must be set to a remote host in production when DB_URL is not set",
            });
          }
        }
      }
    }
  });

export type Environment = z.infer<typeof EnvSchema>;

const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errorMessage = [
    "X Invalid Env variables",
    ...parsedEnv.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`
    ),
  ].join("\n");
  throw new Error(errorMessage);
}

const env = parsedEnv.data;

export function parseEnv(
  data: Record<string, string | undefined>
): Environment {
  const result = EnvSchema.safeParse(data);
  if (!result.success) {
    const errorMessage = [
      "X Invalid env",
      ...result.error.issues.map(
        (issue) => `${issue.path.join(".")}: ${issue.message}`
      ),
    ].join(" | ");
    throw new Error(errorMessage);
  }
  return result.data;
}

export default env;
