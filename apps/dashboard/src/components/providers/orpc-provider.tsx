"use client";

import {
	createAppClient,
	createAppUtils,
	createRPCLink,
} from "@rently/api/client";
import { env } from "@rently/env/web";
import { ORPCProvider } from "@rently/hooks/orpc";

const link = createRPCLink({
	serverURL: env.NEXT_PUBLIC_SERVER_URL,
	getHeaders: async () => {
		if (typeof window !== "undefined") return {};
		const { headers } = await import("next/headers");
		return Object.fromEntries(await headers());
	},
});

const client = createAppClient(link);
const utils = createAppUtils(client);

export function DashboardORPCProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<ORPCProvider client={client} utils={utils}>
			{children}
		</ORPCProvider>
	);
}
