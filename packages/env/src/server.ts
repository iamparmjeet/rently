import { createEnv } from "@t3-oss/env-core";
import dotenv from "dotenv";
import { z } from "zod";

// Local commands provide DATABASE_URL explicitly; dotenv fills in the remaining
// application settings without replacing values already present in the process.
dotenv.config({ path: [".env.local", ".env"], quiet: true });

export const env = createEnv({
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGINS: z
			.string()
			.min(1)
			.transform((s) => s.split(",").map((o) => o.trim())),
		COOKIE_DOMAIN: z.string().min(1),
		WEB_APP_URL: z.url(),
		DASHBOARD_APP_URL: z.url().optional(),
		TENANT_APP_URL: z.url().optional(),
		PUBLIC_DEMO_ENABLED: z.enum(["true", "false"]).default("false"),
		DEMO_OWNER_EMAIL: z.email().optional(),
		DEMO_OWNER_PASSWORD: z.string().min(8).optional(),
		DEMO_TENANT_EMAIL: z.email().optional(),
		DEMO_TENANT_PASSWORD: z.string().min(8).optional(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// Socials Providers
		GOOGLE_CLIENT_ID: z.string(),
		GOOGLE_CLIENT_SECRET: z.string(),
		GITHUB_CLIENT_ID: z.string(),
		GITHUB_CLIENT_SECRET: z.string(),
		EMAIL_FROM: z.string(),
		RESEND_API_KEY: z.string().min(1),
		CLOUDFLARE_ACCOUNT_ID: z.string().min(1),
		R2_BUCKET_NAME: z.string().min(1),
		R2_ACCESS_KEY_ID: z.string().min(1),
		R2_SECRET_ACCESS_KEY: z.string().min(1),
		R2_PUBLIC_URL: z.url(),
		R2_S3_ENDPOINT: z.url(),
		R2_PRIVATE_BUCKET_NAME: z.string().default("keyhq-private-documents"),
		R2_PRIVATE_ACCESS_KEY_ID: z.string().optional(),
		R2_PRIVATE_SECRET_ACCESS_KEY: z.string().optional(),
		AADHAAR_UPLOADS_ENABLED: z.enum(["true", "false"]).default("false"),
	},
	runtimeEnv: process.env,
	emptyStringAsUndefined: true,
});

if (env.PUBLIC_DEMO_ENABLED === "true") {
	for (const key of [
		"DEMO_OWNER_EMAIL",
		"DEMO_OWNER_PASSWORD",
		"DEMO_TENANT_EMAIL",
		"DEMO_TENANT_PASSWORD",
		"DASHBOARD_APP_URL",
		"TENANT_APP_URL",
	] as const) {
		if (!env[key])
			throw new Error(`${key} is required when PUBLIC_DEMO_ENABLED=true`);
	}
}
