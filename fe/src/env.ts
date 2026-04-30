import { createEnv } from "@t3-oss/env-nextjs";
import * as z from "zod";

export const env = createEnv({
	server: {
		BETTER_AUTH_URL: z.url(),
		NODE_ENV: z
			.enum(["development", "test", "production"])
			.default("development"),
	},
	client: {
		NEXT_PUBLIC_BETTER_AUTH_URL: z.url(),
		NEXT_PUBLIC_APP_URL: z.url(),
		NEXT_PUBLIC_API_URL: z.url().default("http://localhost:8787"),
	},
	runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
		BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
		NEXT_PUBLIC_BETTER_AUTH_URL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL,
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
	},
});
