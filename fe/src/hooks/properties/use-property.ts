import { useQuery } from "@tanstack/react-query";
import type { ClientResponse } from "hono/client";
import { client, unwrap } from "@/lib/api-client";
import type { ApiError } from "@/types/api-types";
import { propertyKeys } from "./property-keys";

interface PropertyData {
	property: {
		id: string;
		ownerId: string;
		name: string;
		address: string;
		type: "residential" | "commercial";
		createdAt: string;
		updatedAt: string;
	};
}

interface PropertyUnitData {
	units: Array<{
		id: string;
		propertyId: string;
		unitNumber: string;
		type: "room" | "shop";
		area: number | null;
		baseRent: number;
		description: string | null;
		status: "available" | "occupied";
		createdAt: string;
		updatedAt: string;
	}>;
}

export function useProperty(id: string) {
	return useQuery<PropertyData, ApiError>({
		queryKey: propertyKeys.detail(id),
		queryFn: () =>
			unwrap<PropertyData>(
				client.api.v1.properties[":id"].$get({ param: { id } }),
			),
		// Only run if we have an id
		enabled: !!id,
	});
}

export function usePropertyUnits(propertyId: string) {
	return useQuery<PropertyUnitData, ApiError>({
		queryKey: propertyKeys.units(propertyId),
		queryFn: () =>
			unwrap<PropertyUnitData>(
				client.api.v1.properties[":id"].units.$get({
					param: { id: propertyId },
				}),
			),
		enabled: !!propertyId,
	});
}
