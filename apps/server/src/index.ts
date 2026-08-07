import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import { onError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { ZodToJsonSchemaConverter } from "@orpc/zod/zod4";
import { createContext } from "@rently/api/context";
import { appRouter } from "@rently/api/routers/index";
import { runScheduledReminderJob } from "@rently/api/scheduled-reminders";
import { auth } from "@rently/auth";
import { env } from "@rently/env/server";
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
}): Promise<void> {
	await runScheduledReminderJob({ now: new Date(event.scheduledTime) });
}

export default {
	fetch: app.fetch,
	scheduled,
};
