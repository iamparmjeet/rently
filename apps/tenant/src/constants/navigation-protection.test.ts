// H08: the tenant receipt page lives at top-level /receipts/*, outside the
// /tenant-portal prefix the proxy guards. Fails until the guarded list
// covers it.
import { describe, expect, it } from "vitest";
import { TENANT_PROTECTED_ROUTES } from "./navigation";

describe("tenant protected routes (H08)", () => {
	it("guards the portal and the receipt documents", () => {
		expect(TENANT_PROTECTED_ROUTES).toContain("/tenant-portal");
		expect(TENANT_PROTECTED_ROUTES).toContain("/receipts");
	});
});
