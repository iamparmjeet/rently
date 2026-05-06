export const propertyKeys = {
	// Invalidates ALL Property queries (list, details, units)
	all: ["properties"] as const,

	// Invalidates only list queries
	lists: () => [...propertyKeys.all, "list"] as const,

	// Invalidates a specific list with specific filters
	list: (filters?: { search?: string; type?: string }) =>
		[...propertyKeys.lists(), { filters }] as const,

	// Invalidates only details queries
	details: () => [...propertyKeys.all, "details"] as const,

	// Invalidates a specific property's details
	detail: (id: string) => [...propertyKeys.details(), id] as const,

	// Invalidates units of a specific property
	units: (propertyId: string) =>
		[...propertyKeys.detail(propertyId), "units"] as const,
};

// usage
// queryClient.invalidateQueries({queryKey: propertyKeys.all})
