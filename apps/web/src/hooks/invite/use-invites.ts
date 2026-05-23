import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function useInvites() {
	return useQuery(orpc.rent.invite.listInvites.queryOptions());
}
