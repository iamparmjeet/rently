import type { Context } from "hono";
import type { AppBindings } from "@/types/types";
import { StatusCode, safeError, sendError } from "@/utils";

export const safeHandler =
	<C extends Context<AppBindings>, R extends Response>(
		fn: (c: C) => Promise<R>,
	) =>
	async (c: C): Promise<R | Response> => {
		try {
			return await fn(c);
		} catch (err) {
			console.error("Handler Error", safeError(err));
			return sendError(
				c,
				"Internal Server Error",
				StatusCode.INTERNAL_SERVER_ERROR,
			);
		}
	};

export default safeHandler;
