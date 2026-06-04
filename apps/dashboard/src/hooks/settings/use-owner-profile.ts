import { useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// seSuspenseQuery: data is always defined when component renders —
// the parent wraps ProfileTab in a Suspense boundary.
export function useSuspenseOwnerProfile() {
	return useSuspenseQuery(
		orpc.rent.ownerProfile.getOwnerProfile.queryOptions(),
	);
}
