import type { RouterClient } from "@orpc/server";
import { rentRouter } from "./rent";
import { subscriptionProcedures } from "./subscriptions";

export const appRouter = {
	rent: rentRouter,
	subscription: subscriptionProcedures,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<AppRouter>;
