// H08: every financial document route needs routing-layer protection on top
// of the owner-scoped APIs. Fails until the route lists include them.
import { describe, expect, it } from "vitest";
import { PROTECTED_ROUTES } from "./navigation";

describe("dashboard protected routes (H08)", () => {
	it("guards combined bills, receipts, and credit notes", () => {
		for (const route of ["/combined-bill", "/receipts", "/credit-notes"]) {
			expect(PROTECTED_ROUTES).toContain(route);
		}
	});

	it("keeps guarding the existing financial sections", () => {
		for (const route of ["/payments", "/utilities", "/subscriptions"]) {
			expect(PROTECTED_ROUTES).toContain(route);
		}
	});
});
