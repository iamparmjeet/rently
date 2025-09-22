import path from "node:path";
import { config } from "dotenv";
import { expand } from "dotenv-expand";
import { z } from "zod";

expand(
  config({
    path: path.resolve(
      process.cwd(),
      // biome-ignore lint/style/noProcessEnv: "Only Here"
      process.env.NODE_ENV === "test" ? ".env.test" : ".env"
    ),
  })
);

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
    // Socials Providers
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
          code: z.ZodIssueCode.invalid_type,
          expected: "string",
          received: "undefined",
          path: ["DB_PASSWORD"],
          message: "DB_PASSWORD is required in production",
        });
      }
    }
  });

export type Environment = z.infer<typeof EnvSchema>;

// biome-ignore lint/style/noProcessEnv: "Only Here"
const parsedEnv = EnvSchema.safeParse(process.env);

if (!parsedEnv.success) {
  const errorMessage = `❌ Invalid environment variables:\n${Object.entries(
    parsedEnv.error.flatten().fieldErrors
  )
    .map(([key, errors]) => `${key}: ${errors.join(", ")}`)
    .join("\n")}`;
  throw new Error(errorMessage);
}

const env = parsedEnv.data;

export function parseEnv(
  data: Record<string, string | undefined>
): Environment {
  const result = EnvSchema.safeParse(data);
  if (!result.success) {
    const errorMessage = `❌ Invalid env - ${Object.entries(
      result.error.flatten().fieldErrors
    )
      .map(([key, errors]) => `${key}: ${errors.join(", ")}`)
      .join(" | ")}`;
    throw new Error(errorMessage);
  }
  return result.data;
}

export default env;
