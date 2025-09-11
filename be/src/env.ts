import { z } from "zod";

const EnvSchema = z
  .object({
    NODE_ENV: z.string().default("development"),
    PORT: z.coerce.number().default(9999),
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
    CF_DB_NAME: z.string(),
    CF_D1_DB_ID: z.string(),
    CF_ACCOUNT_ID: z.string(),
    CF_TOKEN_ID: z.string(),
    BETTER_AUTH_SECRET: z.string(),
    BETTER_AUTH_URL: z.string(),
    // Socials Providers
    GOOGLE_CLIENT_ID: z.string(),
    GOOGLE_CLIENT_SECRET: z.string(),
    GITHUB_CLIENT_ID: z.string(),
    GITHUB_CLIENT_SECRET: z.string(),
  })
  .superRefine((input, ctx) => {
    if (input.NODE_ENV === "production") {
      if (!input.CF_ACCOUNT_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          expected: "string",
          received: "undefined",
          path: ["CF_ACCOUNT_ID"],
          message: "CF_ACCOUNT_ID is required in production",
        });
      }
      if (!input.CF_TOKEN_ID) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          expected: "string",
          received: "undefined",
          path: ["CF_TOKEN_ID"],
          message: "CF_TOKEN_ID is required in production",
        });
      }
    }
  });

export type Environment = z.infer<typeof EnvSchema>;

export function parseEnv(
  data: Record<string, string | undefined>
): Environment {
  const { data: env, error } = EnvSchema.safeParse(data);

  if (error) {
    const errorMessage = `❌ Invalid env - ${Object.entries(
      error.flatten().fieldErrors
    )
      .map(([key, errors]) => `${key}: ${errors.join(",")}`)
      .join(" | ")}`;
    throw new Error(errorMessage);
  }

  return env;
}
