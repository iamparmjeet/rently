import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useProperties() {
	return useQuery(orpc.rent.property.listProperties.queryOptions());
}

// select one property from the list cache - avoid a separate network request
export function usePropertyFromList(id: string) {
	return useQuery({
		...orpc.rent.property.listProperties.queryOptions(),
		select: (data) => data.properties.find((p) => p.id === id),
		enabled: !!id,
	});
}

// ----Suspense Variants
// useSuspenseQuery Contract
// - Data is always defined

export function useSuspenseProperties() {
	return useSuspenseQuery(orpc.rent.property.listProperties.queryOptions());
}

export function useSuspensePropertyFromList(id: string) {
	return useSuspenseQuery({
		...orpc.rent.property.listProperties.queryOptions(),
		select: (data) => data.properties.find((p) => p.id === id),
	});
}
