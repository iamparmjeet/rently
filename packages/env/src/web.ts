import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	client: {
		NEXT_PUBLIC_SERVER_URL: z.url(),
		NEXT_PUBLIC_WEB_URL: z.url(),
		NEXT_PUBLIC_TENANT_URL: z.url(),
		NEXT_PUBLIC_DASHBOARD_URL: z.url(),
		NEXT_PUBLIC_ADMIN_URL: z.url(),
		NEXT_PUBLIC_UPI_ID: z.string().min(5).optional(),
		NEXT_PUBLIC_SUPPORT_EMAIL: z.email().optional(),
		NEXT_PUBLIC_DEMO_ENABLED: z.enum(["true", "false"]).default("false"),
	},
	runtimeEnv: {
		NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
		NEXT_PUBLIC_WEB_URL: process.env.NEXT_PUBLIC_WEB_URL,
		NEXT_PUBLIC_DASHBOARD_URL: process.env.NEXT_PUBLIC_DASHBOARD_URL,
		NEXT_PUBLIC_ADMIN_URL: process.env.NEXT_PUBLIC_ADMIN_URL,
		NEXT_PUBLIC_TENANT_URL: process.env.NEXT_PUBLIC_TENANT_URL,
		NEXT_PUBLIC_UPI_ID: process.env.NEXT_PUBLIC_UPI_ID,
		NEXT_PUBLIC_SUPPORT_EMAIL: process.env.NEXT_PUBLIC_SUPPORT_EMAIL,
		NEXT_PUBLIC_DEMO_ENABLED: process.env.NEXT_PUBLIC_DEMO_ENABLED,
	},
	emptyStringAsUndefined: true,
});
