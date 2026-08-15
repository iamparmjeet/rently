import { describe, expect, it } from "vitest";
import {
	computeRentCycleItem,
	getDueDateKey,
	getLocalDateKey,
	getLocalPeriodKey,
	type RentCycleRow,
} from "../helpers/rent-cycle";

const baseRow = (overrides: Partial<RentCycleRow> = {}): RentCycleRow => ({
	leaseId: "lease-1",
	ownerId: "owner-1",
	ownerName: "Owner",
	tenantName: "Tenant",
	tenantEmail: "tenant@example.com",
	propertyName: "Palm Residency",
	unitNumber: "A-1",
	rent: 100_000,
	startDate: new Date("2026-01-01T00:00:00Z"),
	endDate: new Date("2026-09-06T00:00:00Z"),
	rentDueDate: 10,
	leaseStatus: "active",
	paidAmount: 0,
	leaseExpiryAlert: true,
	rentDueReminder: true,
	overdueAlert: true,
	rentDueLeadDays: 3,
	overdueGraceDays: 2,
	suppressedPeriodKeys: [],
	...overrides,
});

describe("rent-cycle date helpers", () => {
	it("uses IST at the UTC date boundary", () => {
		const instant = new Date("2026-08-06T18:30:00.000Z");
		expect(getLocalDateKey(instant)).toBe("2026-08-07");
		expect(getLocalPeriodKey(instant)).toBe("2026-08");
	});

	it("clamps due dates to the end of shorter months", () => {
		expect(getDueDateKey("2026-02", 31)).toBe("2026-02-28");
		expect(getDueDateKey("2026-04", 31)).toBe("2026-04-30");
		expect(getDueDateKey("2026-01", 31)).toBe("2026-01-31");
	});
});

describe("computeRentCycleItem", () => {
	it("emits the configured rent-due reminder", () => {
		const items = computeRentCycleItem(
			baseRow({ endDate: null }),
			"2026-08-07",
		);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			type: "rent_due",
			periodKey: "2026-08",
			thresholdDays: 3,
			dueDate: "2026-08-10",
		});
	});

	it("emits one overdue reminder after the grace period", () => {
		const items = computeRentCycleItem(
			baseRow({ endDate: null }),
			"2026-08-12",
		);
		expect(items).toHaveLength(1);
		expect(items[0]).toMatchObject({
			type: "overdue",
			periodKey: "2026-08",
			thresholdDays: 2,
		});
	});

	it("finds a next-month due date when the lead window crosses a month", () => {
		const items = computeRentCycleItem(
			baseRow({ endDate: null, rentDueDate: 1 }),
			"2026-12-29",
		);
		expect(items).toMatchObject([
			{ type: "rent_due", periodKey: "2027-01", dueDate: "2027-01-01" },
		]);
	});

	it("emits each lease-expiry threshold independently", () => {
		for (const [date, threshold] of [
			["2026-08-07", 30],
			["2026-08-30", 7],
			["2026-09-05", 1],
		] as const) {
			const items = computeRentCycleItem(baseRow(), date);
			expect(items.some((item) => item.type === "lease_expiry")).toBe(true);
			expect(
				items.find((item) => item.type === "lease_expiry")?.thresholdDays,
			).toBe(threshold);
		}
	});

	it("does not remind a fully paid cycle but does remind a partial cycle", () => {
		expect(
			computeRentCycleItem(baseRow({ paidAmount: 100_000 }), "2026-08-07"),
		).toHaveLength(1); // expiry remains independently eligible
		expect(
			computeRentCycleItem(
				baseRow({ endDate: null, paidAmount: 50_000 }),
				"2026-08-07",
			),
		).toHaveLength(1);
		expect(
			computeRentCycleItem(
				baseRow({ endDate: null, paidAmount: 100_000 }),
				"2026-08-07",
			),
		).toHaveLength(0);
	});

	it("skips missing due dates and inactive leases, while exposing suppression to the job", () => {
		expect(
			computeRentCycleItem(
				baseRow({ endDate: null, rentDueDate: null }),
				"2026-08-07",
			),
		).toHaveLength(0);
		expect(
			computeRentCycleItem(
				baseRow({ leaseStatus: "terminated" }),
				"2026-08-07",
			),
		).toHaveLength(0);
		expect(
			computeRentCycleItem(
				baseRow({ endDate: null, suppressedPeriodKeys: ["2026-08"] }),
				"2026-08-07",
			),
		).toHaveLength(1);
		expect(
			computeRentCycleItem(
				baseRow({ startDate: new Date("2026-09-01T00:00:00Z") }),
				"2026-08-07",
			),
		).toHaveLength(0);
	});
});
