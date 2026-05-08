import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@rently/api/routers/index";
import { StatusPhrase } from "@rently/api/utils";
import { env } from "@rently/env/web";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export const queryClient = new QueryClient({
	defaultOptions: {
		queries: {
			staleTime: 5 * 60 * 1000,
			gcTime: 5 * 60 * 1000,
			retry: (failureCount, error) => {
				if ((error as { code?: string }).code === StatusPhrase.UNAUTHORIZED)
					return false;
				if ((error as { code?: string }).code === StatusPhrase.FORBIDDEN)
					return false;
				return failureCount < 2;
			},
		},
	},
	queryCache: new QueryCache({
		onError: (error, query) => {
			if (query.state.data !== undefined) {
				toast.error(`Background refresh failed: ${error.message}`);
			}
		},
	}),
});

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
