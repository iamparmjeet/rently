import { useQuery } from "@tanstack/react-query";
import { client, unwrap } from "@/lib/api-client";
import type { ApiError } from "@/types/api-types";
import { propertyKeys } from "./property-keys";

export interface Property {
	id: string;
	ownerId: string;
	name: string;
	address: string;
	type: "residential" | "commercial";
	createdAt: string;
	updatedAt: string;
}

interface PropertiesData {
	properties: Property[];
}

export function useProperties() {
	return useQuery<PropertiesData, ApiError>({
		queryKey: propertyKeys.list(),
		queryFn: () => {
			return unwrap<PropertiesData>(client.api.v1.properties.$get());
		},
		staleTime: 30 * 10000,
	});
}

export function usePropertyFromList(id: string) {
	return useQuery<PropertiesData, ApiError, Property | undefined>({
		queryKey: propertyKeys.list(),
		queryFn: () => unwrap<PropertiesData>(client.api.v1.properties.$get()),
		select: (data) => data.properties.find((p) => p.id === id),
	});
}
