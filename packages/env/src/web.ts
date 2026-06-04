import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_APP_URL: z.url(),
		NEXT_PUBLIC_SERVER_URL: z.url(),
		NEXT_PUBLIC_WEB_URL: z.url().optional(),
		NEXT_PUBLIC_TENANT_URL: z.url(),
		NEXT_PUBLIC_DASHBOARD_URL: z.url(),
	},
	runtimeEnv: {
		NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
		NEXT_PUBLIC_DASHBOARD_URL: process.env.NEXT_PUBLIC_DASHBOARD_URL,
		NEXT_PUBLIC_TENANT_URL: process.env.NEXT_PUBLIC_TENANT_URL,
	},
	emptyStringAsUndefined: true,
});
