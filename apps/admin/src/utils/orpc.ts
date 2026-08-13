import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@rently/api/routers/index";
import { env } from "@rently/env/web";

const link = new RPCLink({
	url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
	fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
	headers: async () => {
		if (typeof window !== "undefined") return {};
		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
});

export const client: AppRouterClient = createORPCClient(link);
export const orpc = createTanstackQueryUtils(client);
