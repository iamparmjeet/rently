"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useListPlans() {
	return useQuery(orpc.subscription.listPlans.queryOptions());
}
