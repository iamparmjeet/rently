"use client";

import {
	QueryCache,
	QueryClient,
	QueryClientProvider,
} from "@tanstack/react-query";

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				queryCache: new QueryCache({
					onError: (error, query) => {
						toast.error(`Error: ${error.message}`, {
							action: { label: "Retry", onClick: query.invalidate },
						});
					},
				}),
				defaultOptions: {
					queries: {
						staleTime: 5 * 60 * 1000,
						gcTime: 5 * 60 * 1000,
						retry: 2,
					},
				},
			}),
	);
	return (
		<QueryClientProvider client={queryClient}>
			{children}
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	);
}

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { toast } from "sonner";
