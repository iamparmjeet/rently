import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@rently/api/context";
import {
	repairPublicDemoPersona,
	resetPublicDemoWorkspace,
} from "@rently/api/modules/sample-workspace";
import { runTenantDocumentCleanupJob } from "@rently/api/modules/tenant-documents/cleanup";
import { createR2TenantDocumentStorage } from "@rently/api/modules/tenant-documents/storage";
import { appRouter } from "@rently/api/routers/index";
import { runScheduledReminderJob } from "@rently/api/scheduled-reminders";
import { auth } from "@rently/auth";
import { db } from "@rently/db";
import { ACCOUNT_MODES } from "@rently/db/constants/workspace-modes";
import { session, user } from "@rently/db/schema/auth";
import { env } from "@rently/env/server";
import { and, eq } from "drizzle-orm";
import { initLogger } from "evlog";
import {
	type BetterAuthInstance,
	createAuthMiddleware,
} from "evlog/better-auth";
import { type EvlogVariables, evlog } from "evlog/hono";
import { Hono } from "hono";
import { cors } from "hono/cors";

initLogger({
	env: { service: "rently-server" },
});

const identifyUser = createAuthMiddleware(auth as BetterAuthInstance, {
	exclude: ["/api/auth/**"],
	maskEmail: true,
});

const allowedOrigins = env.CORS_ORIGINS;

const app = new Hono<EvlogVariables>();

function demoConfig() {
	const {
		DEMO_OWNER_EMAIL: ownerEmail,
		DEMO_OWNER_PASSWORD: ownerPassword,
		DEMO_TENANT_EMAIL: tenantEmail,
		DEMO_TENANT_PASSWORD: tenantPassword,
		DASHBOARD_APP_URL: dashboardUrl,
		TENANT_APP_URL: tenantUrl,
	} = env;
	if (
		!ownerEmail ||
		!ownerPassword ||
		!tenantEmail ||
		!tenantPassword ||
		!dashboardUrl ||
		!tenantUrl
	)
		return null;
	return {
		ownerEmail,
		ownerPassword,
		tenantEmail,
		tenantPassword,
		dashboardUrl,
		tenantUrl,
	};
}

app.use(
	"/*",
	cors({
		origin: allowedOrigins,
		allowMethods: ["GET", "POST", "OPTIONS", "PATCH", "DELETE"],
		allowHeaders: [
			"Content-Type",
			"Authorization",
			"Accept",
			"Cache-Control",
			"X-Requested-With",
		],

		exposeHeaders: ["Set-Cookie"],
		credentials: true,

		maxAge: 86400, // 24 Hours
	}),
);

app.use(evlog());
app.use("*", async (c, next) => {
	await identifyUser(c.get("log"), c.req.raw.headers, c.req.path);
	await next();
});

const publicDemoProtectedAuthPaths = new Set([
	"/api/auth/update-user",
	"/api/auth/change-email",
	"/api/auth/change-password",
	"/api/auth/revoke-other-sessions",
	"/api/auth/link-social",
	"/api/auth/unlink-account",
	"/api/auth/delete-user",
]);

app.use("/api/auth/*", async (c, next) => {
	if (!publicDemoProtectedAuthPaths.has(c.req.path)) return next();
	const current = await auth.api.getSession({ headers: c.req.raw.headers });
	if (current?.user.accountMode === ACCOUNT_MODES.PUBLIC_DEMO) {
		return c.json({ code: "DEMO_FEATURE_DISABLED" }, 403);
	}
	return next();
});

app.post("/api/demo/session", async (c) => {
	if (env.PUBLIC_DEMO_ENABLED !== "true") return c.notFound();
	const config = demoConfig();
	if (!config) return c.notFound();
	const origin = c.req.header("origin");
	if (!origin || !env.CORS_ORIGINS.includes(origin)) {
		return c.json({ code: "DEMO_PERSONA_UNAVAILABLE" }, 403, {
			"Cache-Control": "no-store",
		});
	}
	const body = await c.req
		.json<{ persona?: "owner" | "tenant" }>()
		.catch(() => null);
	if (body?.persona !== "owner" && body?.persona !== "tenant") {
		return c.json({ code: "DEMO_PERSONA_UNAVAILABLE" }, 400, {
			"Cache-Control": "no-store",
		});
	}
	const existing = await auth.api.getSession({ headers: c.req.raw.headers });
	const existingMode = existing?.user.accountMode;
	if (existing?.user && existingMode !== ACCOUNT_MODES.PUBLIC_DEMO) {
		return c.json({ code: "REAL_SESSION_ACTIVE" }, 409, {
			"Cache-Control": "no-store",
		});
	}
	const email =
		body.persona === "owner" ? config.ownerEmail : config.tenantEmail;
	const password =
		body.persona === "owner" ? config.ownerPassword : config.tenantPassword;
	const [target] = await db
		.select()
		.from(user)
		.where(
			and(
				eq(user.email, email),
				eq(user.accountMode, ACCOUNT_MODES.PUBLIC_DEMO),
			),
		)
		.limit(1);
	if (!target)
		return c.json({ code: "DEMO_PERSONA_UNAVAILABLE" }, 503, {
			"Cache-Control": "no-store",
		});
	if (existing?.user.id === target.id) {
		const redirectUrl =
			body.persona === "owner" ? config.dashboardUrl : config.tenantUrl;
		return c.json({ persona: body.persona, redirectUrl }, 200, {
			"Cache-Control": "no-store",
		});
	}
	const [owner] = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				eq(user.email, config.ownerEmail),
				eq(user.accountMode, ACCOUNT_MODES.PUBLIC_DEMO),
			),
		)
		.limit(1);
	const [tenant] = await db
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				eq(user.email, config.tenantEmail),
				eq(user.accountMode, ACCOUNT_MODES.PUBLIC_DEMO),
			),
		)
		.limit(1);
	if (!owner || !tenant)
		return c.json({ code: "DEMO_PERSONA_UNAVAILABLE" }, 503, {
			"Cache-Control": "no-store",
		});
	await repairPublicDemoPersona({
		database: db,
		ownerId: owner.id,
		tenantId: tenant.id,
		persona: body.persona,
	});
	const authResponse = await auth.handler(
		new Request(
			new URL("/api/auth/sign-in/email", env.BETTER_AUTH_URL).toString(),
			{
				method: "POST",
				headers: { "Content-Type": "application/json", Origin: origin },
				body: JSON.stringify({ email, password, rememberMe: false }),
			},
		),
	);
	if (!authResponse.ok)
		return c.json({ code: "DEMO_PERSONA_UNAVAILABLE" }, 401, {
			"Cache-Control": "no-store",
		});
	if (existing?.session && existingMode === ACCOUNT_MODES.PUBLIC_DEMO) {
		await db.delete(session).where(eq(session.id, existing.session.id));
	}
	const headers = new Headers({ "Cache-Control": "no-store" });
	const responseHeaders = authResponse.headers as Headers & {
		getSetCookie?: () => string[];
	};
	const cookies = responseHeaders.getSetCookie?.() ?? [
		authResponse.headers.get("set-cookie"),
	];
	for (const cookie of cookies) {
		if (cookie) headers.append("Set-Cookie", cookie);
	}
	const redirectUrl =
		body.persona === "owner" ? config.dashboardUrl : config.tenantUrl;
	return new Response(JSON.stringify({ persona: body.persona, redirectUrl }), {
		status: 200,
		headers: {
			...Object.fromEntries(headers),
			"Content-Type": "application/json",
		},
	});
});

app.on(["POST", "GET"], "/api/auth/*", (c) => auth.handler(c.req.raw));

export const apiHandler = new OpenAPIHandler(appRouter, {
	plugins: [
		new OpenAPIReferencePlugin({
			schemaConverters: [new ZodToJsonSchemaConverter()],
		}),
	],
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

export const rpcHandler = new RPCHandler(appRouter, {
	interceptors: [
		onError((error) => {
			console.error(error);
		}),
	],
});

app.use("/*", async (c, next) => {
	const context = await createContext({ context: c });

	const rpcResult = await rpcHandler.handle(c.req.raw, {
		prefix: "/rpc",
		context: context,
	});

	if (rpcResult.matched) {
		return new Response(rpcResult.response.body, {
			status: rpcResult.response.status,
			statusText: rpcResult.response.statusText,
			headers: rpcResult.response.headers,
		});
	}

	const apiResult = await apiHandler.handle(c.req.raw, {
		prefix: "/api-reference",
		context: context,
	});

	if (apiResult.matched) {
		// WHY: same reasoning as rpcResult above
		return new Response(apiResult.response.body, {
			status: apiResult.response.status,
			statusText: apiResult.response.statusText,
			headers: apiResult.response.headers,
		});
	}

	await next();
});

app.get("/", (c) => {
	return c.text("OK");
});

export async function scheduled(event: {
	scheduledTime: number;
	cron?: string;
}): Promise<void> {
	if (event.cron === "*/30 * * * *") {
		if (env.PUBLIC_DEMO_ENABLED !== "true") return;
		const config = demoConfig();
		if (!config)
			throw new Error(
				"Public demo is enabled but configuration is incomplete.",
			);
		const startedAt = Date.now();
		const [owner] = await db
			.select({ id: user.id })
			.from(user)
			.where(
				and(
					eq(user.email, config.ownerEmail),
					eq(user.accountMode, ACCOUNT_MODES.PUBLIC_DEMO),
				),
			)
			.limit(1);
		const [tenant] = await db
			.select({ id: user.id })
			.from(user)
			.where(
				and(
					eq(user.email, config.tenantEmail),
					eq(user.accountMode, ACCOUNT_MODES.PUBLIC_DEMO),
				),
			)
			.limit(1);
		if (!owner || !tenant)
			throw new Error("Public demo identities are not bootstrapped.");
		try {
			const result = await resetPublicDemoWorkspace({
				database: db,
				ownerId: owner.id,
				tenantId: tenant.id,
				now: new Date(event.scheduledTime),
			});
			console.info("[scheduled:demo-reset] complete", {
				ownerId: owner.id,
				durationMs: Date.now() - startedAt,
				properties: result.properties,
				tenants: result.tenants,
			});
		} catch (error) {
			console.error("[scheduled:demo-reset] failed", {
				ownerId: owner.id,
				durationMs: Date.now() - startedAt,
				error,
			});
			throw error;
		}
		return;
	}
	if (event.cron && event.cron !== "30 2 * * *") {
		console.warn("[scheduled] ignored unknown cron", { cron: event.cron });
		return;
	}
	const now = new Date(event.scheduledTime);
	const [reminders, documents] = await Promise.allSettled([
		runScheduledReminderJob({ now }),
		Promise.resolve().then(() =>
			runTenantDocumentCleanupJob({
				database: db,
				storage: createR2TenantDocumentStorage(),
				now,
			}),
		),
	]);
	if (reminders.status === "rejected") {
		console.error("[scheduled] reminders failed", reminders.reason);
	}
	if (documents.status === "rejected") {
		console.error(
			"[scheduled] tenant document cleanup failed",
			documents.reason,
		);
	}
}

export default {
	fetch: app.fetch,
	scheduled,
};
