import type { RouterClient } from "@orpc/server";
import { rentRouter } from "./rent";

export const appRouter = {
	// Debug or remove or moved
	// privateDate: protectedProcedure.handler(({ context }) => ({
	// 	message: "This is private",
	// 	user: context.user,
	// })),
	rent: rentRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<AppRouter>;
