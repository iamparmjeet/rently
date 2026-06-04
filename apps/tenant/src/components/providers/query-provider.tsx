"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";
import { getQueryClient } from "@/utils/query-client";

export function QueryProvider({ children }: { children: React.ReactNode }) {
	// getQueryClient() returns the browser singleton when called client-side.
	// Calling it here (inside a Client Component) is always browser-side.
	const [queryClient] = useState(getQueryClient);
	return (
		<QueryClientProvider client={queryClient}>
			{children}
			<ReactQueryDevtools initialIsOpen={false} />
		</QueryClientProvider>
	);
}
