import type { QueryClient } from "@tanstack/react-query";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { orpc } from "../../utils/orpc";

export type PeriodBalanceInput = {
	leaseId?: string;
	agreementId?: string;
	all?: boolean;
};

// C06: single source of period-aware balances for owner screens. The input
// mirrors the server contract: exactly one of leaseId, agreementId, or all.
// `options` flows into useQuery (e.g. `enabled`) for screens whose lease id
// only becomes known after another query resolves.
export function usePeriodBalance(
	input: PeriodBalanceInput,
	options?: { enabled?: boolean },
) {
	return useQuery({
		...orpc.rent.balance.getPeriodBalance.queryOptions({ input }),
		...options,
	});
}

export function useSuspensePeriodBalance(input: PeriodBalanceInput) {
	return useSuspenseQuery(
		orpc.rent.balance.getPeriodBalance.queryOptions({ input }),
	);
}

// Balance rows keyed by lease for screens that join balances onto leases,
// utilities, or tenants they already have loaded.
export function balanceByLeaseId<T extends { leaseId: string }>(
	balances: Array<T> | undefined,
): Map<string, T> {
	const map = new Map<string, T>();
	for (const balance of balances ?? []) map.set(balance.leaseId, balance);
	return map;
}

// Every payment/credit/void mutation moves both ledgers, so each of their
// onSuccess/settled blocks calls this alongside the list invalidations.
export function invalidatePeriodBalances(queryClient: QueryClient) {
	queryClient.invalidateQueries({
		queryKey: orpc.rent.balance.key(),
	});
}
