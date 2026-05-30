import { useORPC } from "@rently/hooks/orpc";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

export function useInvites() {
	const orpc = useORPC();
	return useQuery(orpc.rent.invite.listInvites.queryOptions());
}

export function useSuspenseInvites() {
	const orpc = useORPC();

	return useSuspenseQuery(orpc.rent.invite.listInvites.queryOptions());
}
