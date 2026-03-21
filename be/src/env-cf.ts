import { z } from "zod";

// Used by Cloudflare Workers runtime (no dotenv, env comes from wrangler bindings)
const EnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
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
    DB_NAME: z.string(),
    DB_USER: z.string(),
    DB_PASSWORD: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string(),
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
    EMAIL_FROM: z.string(),
  })
  .superRefine((input, ctx) => {
    if (input.NODE_ENV === "production") {
      if (!input.DB_PASSWORD) {
        ctx.addIssue({
          code: "custom",
          path: ["DB_PASSWORD"],
          message: "DB_PASSWORD is required in production",
        });
      }
    }
  });

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(
  data: Record<string, string | undefined>
): Environment {
  const result = EnvSchema.safeParse(data);
  if (!result.success) {
    const errorMessage = [
      "❌ Invalid env:",
      ...result.error.issues.map(
        (issue) => `  ${issue.path.join(".")}: ${issue.message}`
      ),
    ].join(" | ");
    throw new Error(errorMessage);
  }
  return result.data;
}
