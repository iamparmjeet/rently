import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "./routers/index";

type LinkContext = Record<never, never>; // ← named for clarity

export function createRPCLink(config: {
	serverURL: string;
	getHeaders?: () => Promise<Record<string, string>>;
}): RPCLink<LinkContext> {
	return new RPCLink<LinkContext>({
		// ← explicit context type
		url: `${config.serverURL}/rpc`,
		fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
		headers: config.getHeaders ?? (() => Promise.resolve({})),
	});
}

export function createAppClient(link: RPCLink<LinkContext>): AppRouterClient {
	return createORPCClient(link) as unknown as AppRouterClient;
}

export function createAppUtils(client: AppRouterClient) {
	return createTanstackQueryUtils(client);
}

export type ORPCUtils = ReturnType<typeof createAppUtils>;
