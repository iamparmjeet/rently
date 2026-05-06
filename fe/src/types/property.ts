import type { InferResponseType } from "hono/client";
import { client } from "@/lib/api-client";

// Derive types directly from BE response
// If BE changes its response shape, these types update automatically
type PropertiesResponse = InferResponseType
  typeof client.api.v1.properties.$get
>;
type PropertyResponse = InferResponseType
  (typeof client.api.v1.properties)[":id"]["$get"]
    >;

    type UnitsResponse = InferResponseType
      typeof client.api.v1.properties[':propertyId']['units']['$get'],
      200 // ← status code (important!)
    >;

// Extract the property from the response
export type Property = NonNullable
  PropertiesResponse extends { properties: infer P } ? P : never
>[number];

// For the property detail (with units computed on FE)
export interface PropertyWithUnits extends Property {
  units: Unit[];
  totalUnits: number;
  occupiedUnits: number;
  vacantUnits: number;
  monthlyRevenue: number;
}

// Keep filter type as-is - it's a UI concept not from BE
export interface PropertyFilters {
  search: string;
  type: "residential" | "commercial" | "all";
  sortBy: "name" | "created_at" | "units";
  sortOrder: "asc" | "desc";
}
