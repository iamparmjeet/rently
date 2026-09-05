import { describe, expect, it } from "vitest";
import z from "zod";
import { CreatePaymentSchema } from "./payment";

// B01: dashboard's PaymentFormSchema overwrites keys via .extend(), which
// zod forbids on schemas carrying refinements. The pairing refine therefore
// lives on CreatePaymentRequestSchema — this pins the base as extendable so
// a local check-types/vitest run catches what only the CI build caught once.
describe("CreatePaymentSchema extensibility", () => {
	it("stays extendable for form-layer overrides", () => {
		expect(() =>
			CreatePaymentSchema.extend({
				amount: z.number().positive(),
				paymentDate: z.string().min(1),
			}),
		).not.toThrow();
	});
});
