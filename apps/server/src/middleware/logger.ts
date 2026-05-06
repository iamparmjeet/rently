import { initLogger } from "evlog";
import { type EvlogVariables, evlog } from "evlog/hono";
import type { MiddlewareHandler } from "hono";
import type { AppBindings } from "../types/types";

initLogger({
	env: { service: "rently-api" },
});

export const loggerMiddleware: MiddlewareHandler<AppBindings & EvlogVariables> =
	evlog();

export { log } from "evlog";
