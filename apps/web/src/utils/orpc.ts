import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { AppRouterClient } from "@rently/api/routers/index";
import { env } from "@rently/env/web";

const link = new RPCLink({
	url: `${env.NEXT_PUBLIC_SERVER_URL}/rpc`,
	fetch: (url, init) => fetch(url, { ...init, credentials: "include" }),
	// WHY: on the server, forward the incoming request's cookies so
	// Better Auth can read the session. On the client, the browser
	// handles cookies automatically — return empty headers.
	headers: async () => {
		if (typeof window !== "undefined") {
			return {};
		}
		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
});

// WHY: typed as AppRouterClient so every call site gets full
// autocomplete and return type inference without importing AppRouter directly.
export const client: AppRouterClient = createORPCClient(link);

// WHY: exported for any RSC or server action that needs
// TanStack Query key helpers (e.g. revalidation, prefetching).
export const orpc = createTanstackQueryUtils(client);
