import type { RouterClient } from "@orpc/server";
import { rentRouter } from "./rent";

export const appRouter = {
	rent: rentRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<AppRouter>;
