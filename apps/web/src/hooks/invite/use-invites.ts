import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useInvites() {
	return useQuery(orpc.rent.invite.listInvites.queryOptions());
}

export function useSuspenseInvites() {
	return useSuspenseQuery(orpc.rent.invite.listInvites.queryOptions());
}
