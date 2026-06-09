"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useMySubscription() {
	return useQuery(orpc.subscription.getMySubscription.queryOptions());
}
