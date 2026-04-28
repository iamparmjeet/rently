"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { env } from "@/env";
export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 60 * 5 * 1000, // 5 Min
						gcTime: 5 * 60 * 1000, // 5 Min
						retry: 2,
					},
				},
			}),
	);
	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{env.NODE_ENV === "development" && (
				<ReactQueryDevtools initialIsOpen={false} />
			)}
		</QueryClientProvider>
	);
}

import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
