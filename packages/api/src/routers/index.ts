import type { RouterClient } from "@orpc/server";
import { protectedProcedure } from "../procedures";
import { rentRouter } from "./rent";

export const appRouter = {
	privateDate: protectedProcedure.handler(({ context }) => ({
		message: "This is private",
		user: context.user,
	})),
	rent: rentRouter,
};

export type AppRouter = typeof appRouter;
export type AppRouterClient = RouterClient<AppRouter>;
