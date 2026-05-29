import type { ORPCUtils } from "@rently/api";
import type { AppRouterClient } from "@rently/api/routers/index";
import { createContext, useContext } from "react";

interface ORPCContextValue {
	client: AppRouterClient;
	utils: ORPCUtils;
}

const ORPCContext = createContext<ORPCContextValue | null>(null);

export function ORPCProvider({
	client,
	utils,
	children,
}: {
	client: AppRouterClient;
	utils: ORPCUtils;
	children: React.ReactNode;
}) {
	return (
		<ORPCContext.Provider value={{ client, utils }}>
			{children}
		</ORPCContext.Provider>
	);
}

export function useClient(): AppRouterClient {
	const ctx = useContext(ORPCContext);
	if (!ctx) throw new Error("useClient must be used within <ORPCProvider>");
	return ctx.client;
}

export function useORPC(): ORPCUtils {
	const ctx = useContext(ORPCContext);
	if (!ctx) throw new Error("useORPC must be used within <ORPCProvider>");
	return ctx.utils;
}
