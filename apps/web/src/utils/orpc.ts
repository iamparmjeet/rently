import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@rently/api/routers/index";
import { env } from "@rently/env/web";

// RPC link
const link = new RPCLink({
	url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
	fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
	headers: async () => {
		if (typeof window !== "undefined") {
			return {};
		}

		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
});

// ------------------- Client -> typed as RouterClient (plain callable functions) ----
export const client: AppRouterClient = createORPCClient(link);

// --------- orpc - Tansatck Query utilities
// No Type annotation here - let ts infer DecoratedClient<Approuter>
export const orpc = createTanstackQueryUtils(client);
