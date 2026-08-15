import {
	environmentManager,
	QueryCache,
	QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";

function makeQueryClient(): QueryClient {
	return new QueryClient({
		queryCache: new QueryCache({
			onError: (error, query) => {
				toast.error(error.message, {
					action: { label: "Retry", onClick: () => query.invalidate() },
				});
			},
		}),
		defaultOptions: {
			queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 1 },
		},
	});
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
	if (environmentManager.isServer()) return makeQueryClient();
	if (!browserQueryClient) browserQueryClient = makeQueryClient();
	return browserQueryClient;
}
