import type { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";
import { orpc } from "../utils/orpc";
import { invalidateFinancialViews } from "./financial-invalidation";

// H03 regression rationale: each money-moving mutation maintained its own
// invalidation subset, so mounted views went stale — tenant cards (their
// overdue snapshot rides on listTenants, invalidated by nothing), the Net
// discounts card (revenue, missed by createCredit), and the payment list
// (missed by recordUtilityPayment, which creates a payment row). These tests
// pin the central mapping so a dropped view fails here instead of in the UI.

function recordingClient() {
	const seen: Array<{ queryKey: unknown }> = [];
	const queryClient = {
		invalidateQueries: vi.fn((arg: { queryKey: unknown }) => {
			seen.push(arg);
		}),
	} as unknown as QueryClient;
	return { queryClient, seen };
}

function keysOf(seen: Array<{ queryKey: unknown }>) {
	return seen.map((call) => JSON.stringify(call.queryKey));
}

describe("invalidateFinancialViews", () => {
	it("invalidates every view a money move can stale", () => {
		const { queryClient, seen } = recordingClient();
		invalidateFinancialViews(queryClient);
		const keys = keysOf(seen);
		for (const expected of [
			orpc.rent.payment.listPayments.key(),
			orpc.rent.utility.listUtilities.key(),
			orpc.rent.credit.listCredits.key(),
			orpc.rent.tenant.listTenants.key(),
			orpc.rent.stats.getRevenueDashboard.key(),
			orpc.rent.balance.key(),
		]) {
			expect(keys).toContain(JSON.stringify(expected));
		}
	});

	it("uses prefix keys so filtered lists refresh too", () => {
		const { queryClient, seen } = recordingClient();
		invalidateFinancialViews(queryClient);
		// A prefix key carries no input: any mounted filtered list
		// (leaseId-scoped payments, per-utility detail via balance) matches.
		for (const call of seen) {
			expect(call.queryKey).toBeDefined();
		}
		expect(seen.length).toBe(6);
	});

	it("leaves dashboard stats alone — counts never move money", () => {
		const { queryClient, seen } = recordingClient();
		invalidateFinancialViews(queryClient);
		const keys = keysOf(seen);
		expect(keys).not.toContain(
			JSON.stringify(orpc.rent.stats.getDashboardStats.key()),
		);
	});
});
