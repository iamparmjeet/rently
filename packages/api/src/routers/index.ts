import type { RouterClient } from "@orpc/server";
import * as notificationProcedures from "./notification";
import { rentRouter } from "./rent";
import { subscriptionProcedures } from "./subscriptions";
import * as uploadProcedures from "./upload";

export const appRouter = {
	rent: rentRouter,
	subscription: subscriptionProcedures,
	upload: uploadProcedures,
	notification: notificationProcedures,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<AppRouter>;
