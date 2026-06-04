import {
	environmentManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

function makeQueryClient(): QueryClient {
	return new QueryClient({
		// QueryCache.onError is the global error handler.
		// On the server it's a no-op (sonner checks for browser env internally).
		// On the browser it shows a toast with a retry action.
		queryCache: new QueryCache({
			onError: (error, query) => {
				toast.error(`Something went wrong: ${error.message}`, {
					action: {
						label: "Retry",
						onClick: () => query.invalidate(),
					},
				});
			},
		}),
		defaultOptions: {
			queries: {
				// CRITICAL -> Must be > 0 to prevent hydration refetch
				staleTime: 60 * 1000,
				gcTime: 5 * 60 * 1000,
				retry: 2,
			},
		},
	});
}

// Browser - Lives for the tab's lifetime
let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
	if (environmentManager.isServer()) {
		// Server - Always Create a new instance
		// Each Request gets its own isolated cache - no data leaks b/w users
		return makeQueryClient();
	}

	// Browser: create once, reuse forever.
	// Same instance QueryClientProvider will hold
	if (!browserQueryClient) {
		browserQueryClient = makeQueryClient();
	}
	return browserQueryClient;
}
