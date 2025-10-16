import { z } from "zod";

// ✅ Only include *public* variables prefixed with NEXT_PUBLIC_*
const EnvSchema = z.object({
  NODE_ENV: z.string().default("development"),
  NEXT_PUBLIC_API_URL: z.string().url().default("http://localhost:8787"),
});

type FrontendEnv = z.infer<typeof EnvSchema>;

// ✅ Validate using process.env (available at build time)
const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const message = Object.entries(parsed.error.flatten().fieldErrors)
    .map(([key, errors]) => `${key}: ${errors.join(", ")}`)
    .join("\n");
  throw new Error(`❌ Invalid frontend environment:\n${message}`);
}

export const env = parsed.data;
export type { FrontendEnv };
