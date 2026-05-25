import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";
import { useProperty } from "./use-property";

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

export function usePropertySmart(id: string) {
	const fromList = usePropertyFromList(id);

	// if list cache gave us data, use it,m otherwise fetch directly
	const fromServer = useProperty(id);

	// Return list cache version if populate, otherwise this direct fetch
	return fromList.data ? fromList : fromServer;
}

// ------------- Suspense Variants
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
