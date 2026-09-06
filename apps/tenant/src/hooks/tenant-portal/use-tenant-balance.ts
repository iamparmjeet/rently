import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

// C07: the tenant's period-aware balances (per-lease charges, current vs
// older rent due, utilities). The server scopes `{all: true}` to the leases
// where the caller is the tenant.
export function useTenantBalance() {
	return useQuery(
		orpc.rent.balance.getPeriodBalance.queryOptions({ input: { all: true } }),
	);
}
