import type { QueryClient } from "@tanstack/react-query";
import { invalidatePeriodBalances } from "../hooks/balance/use-period-balance";
import { orpc } from "../utils/orpc";

// H03: one mapping for every view a money-moving mutation can leave stale.
// A payment, credit, void, or combined settlement changes the payment ledger
// (listPayments), utility dues (listUtilities), discount state (listCredits),
// the tenant cards' overdue snapshot (listTenants carries a server-derived
// overdue per lease — C08), the revenue/overdue aggregates
// (getRevenueDashboard reads the signed ledger plus period charges), and the
// period dues (rent.balance). Every mutation below must call this instead of
// maintaining its own subset — per-site subsets are the drift this slice
// removes. Detail keys (getPaymentById, getUtilityById, getCreditNote) stay at
// the call site because only it knows the affected id.
//
// Deliberately excluded: getDashboardStats (property/unit/lease counts only —
// money never changes it; lifecycle hooks own it) and listLeases (contract
// terms, not dues).
//
// Utility-bill create/update/remove only change dues, not the ledger, so those
// hooks invalidate listUtilities plus invalidatePeriodBalances (the C05 model
// carries a utilities section) — not this full set. Tenant-portal reading
// submit already covers its own balance + utility views. Credit reversal has
// no dashboard mutation hook yet (API-only); its future hook must use this.
export function invalidateFinancialViews(queryClient: QueryClient) {
	queryClient.invalidateQueries({
		queryKey: orpc.rent.payment.listPayments.key(),
	});
	queryClient.invalidateQueries({
		queryKey: orpc.rent.utility.listUtilities.key(),
	});
	queryClient.invalidateQueries({
		queryKey: orpc.rent.credit.listCredits.key(),
	});
	queryClient.invalidateQueries({
		queryKey: orpc.rent.tenant.listTenants.key(),
	});
	queryClient.invalidateQueries({
		queryKey: orpc.rent.stats.getRevenueDashboard.key(),
	});
	invalidatePeriodBalances(queryClient);
}
