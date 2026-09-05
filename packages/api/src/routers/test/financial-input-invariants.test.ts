import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	LEASE_AGREEMENT_ARRANGEMENT,
	LEASE_CATEGORY,
	LEASE_STATUSES,
	PROPERTY_TYPES,
	UNIT_STATUSES,
	UNIT_TYPES,
	UTILITY_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import {
	leaseAgreements,
	leases,
	payments,
	properties,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { inArray } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

vi.mock("@rently/email", () => ({
	sendAgreementPaymentReceiptEmail: vi.fn(),
	sendPaymentReceiptEmail: vi.fn(),
	sendUtilityBillEmail: vi.fn(),
}));

import { createLease, updateLease } from "../rent/lease";
import { createUnit, updateUnit } from "../rent/unit";
import {
	createUtility,
	createUtilityBatch,
	updateUtility,
} from "../rent/utility";

const db = createDb();

const createdUserIds: string[] = [];
const createdProfileIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];
const createdLeaseIds: string[] = [];
const createdAgreementIds: string[] = [];
const createdUtilityIds: string[] = [];

async function createOwnerWithProperty() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "Owner A",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const tenantId = crypto.randomUUID();
	createdUserIds.push(tenantId);
	await db.insert(user).values({
		id: tenantId,
		name: "Tenant A",
		email: `${tenantId}@test.keyhq.invalid`,
		role: "tenant",
	});
	const profileId = crypto.randomUUID();
	createdProfileIds.push(profileId);
	await db.insert(tenantProfiles).values({
		id: profileId,
		userId: tenantId,
		createdById: ownerId,
	});
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name: "Palm Residency",
		address: "1 Palm Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	return { ownerId, tenantId, propertyId };
}

async function createAvailableUnit(propertyId: string) {
	const unitId = crypto.randomUUID();
	createdUnitIds.push(unitId);
	await db.insert(units).values({
		id: unitId,
		propertyId,
		unitNumber: `B02-${unitId.slice(0, 4)}`,
		type: UNIT_TYPES.ONEBHK,
		baseRent: 10_000_00,
		status: UNIT_STATUSES.AVAILABLE,
	});
	return unitId;
}

function clientsFor(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return {
		lease: createRouterClient({ createLease, updateLease }, { context }),
		unit: createRouterClient({ createUnit, updateUnit }, { context }),
		utility: createRouterClient(
			{ createUtility, createUtilityBatch, updateUtility },
			{ context },
		),
	};
}

const LEASE_DATES = {
	startDate: new Date("2026-01-01T00:00:00.000Z"),
	endDate: new Date("2027-01-01T00:00:00.000Z"),
};

afterEach(async () => {
	// Derive cleanup from fixture units so rows created by currently-valid
	// (pre-fix) negative paths are removed too, not just tracked ids.
	if (createdUnitIds.length > 0) {
		const leaseRows = await db
			.select({ id: leases.id, agreementId: leases.agreementId })
			.from(leases)
			.where(inArray(leases.unitId, createdUnitIds));
		const leaseIds = leaseRows.map((row) => row.id);
		if (leaseIds.length > 0) {
			await db.delete(payments).where(inArray(payments.leaseId, leaseIds));
			await db.delete(utilities).where(inArray(utilities.leaseId, leaseIds));
			await db.delete(leases).where(inArray(leases.id, leaseIds));
		}
		const agreementIds = [
			...new Set(
				[
					...leaseRows.map((row) => row.agreementId),
					...createdAgreementIds,
				].filter((id): id is string => id != null),
			),
		];
		if (agreementIds.length > 0) {
			await db
				.delete(leaseAgreements)
				.where(inArray(leaseAgreements.id, agreementIds));
		}
		await db.delete(units).where(inArray(units.id, createdUnitIds));
	}
	if (createdPropertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, createdPropertyIds));
	}
	if (createdProfileIds.length > 0) {
		await db
			.delete(tenantProfiles)
			.where(inArray(tenantProfiles.id, createdProfileIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdUserIds.length = 0;
	createdProfileIds.length = 0;
	createdPropertyIds.length = 0;
	createdUnitIds.length = 0;
	createdLeaseIds.length = 0;
	createdAgreementIds.length = 0;
	createdUtilityIds.length = 0;
	mocks.getSession.mockReset();
});

describe("financial input invariants (B02) — leases", () => {
	it("rejects non-positive rent", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const { lease } = clientsFor(ownerId);
		for (const rent of [0, -100]) {
			await expect(
				lease.createLease({
					unitId,
					tenantId,
					...LEASE_DATES,
					rent,
					deposit: 100,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
	});

	it("rejects negative deposits", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const { lease } = clientsFor(ownerId);
		await expect(
			lease.createLease({
				unitId,
				tenantId,
				...LEASE_DATES,
				rent: 10_000_00,
				deposit: -1,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects due days outside 1-31", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const { lease } = clientsFor(ownerId);
		for (const rentDueDate of [0, 32]) {
			await expect(
				lease.createLease({
					unitId,
					tenantId,
					...LEASE_DATES,
					rent: 10_000_00,
					rentDueDate,
				}),
			).rejects.toMatchObject({ code: "BAD_REQUEST" });
		}
	});

	it("rejects an end date before the start date", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const { lease } = clientsFor(ownerId);
		await expect(
			lease.createLease({
				unitId,
				tenantId,
				startDate: LEASE_DATES.endDate,
				endDate: LEASE_DATES.startDate,
				rent: 10_000_00,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("accepts boundary values", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const { lease } = clientsFor(ownerId);
		const result = await lease.createLease({
			unitId,
			tenantId,
			...LEASE_DATES,
			rent: 1,
			deposit: 0,
			rentDueDate: 31,
		});
		createdLeaseIds.push(result.lease.id);
		if (result.lease.agreementId)
			createdAgreementIds.push(result.lease.agreementId);
		expect(result.lease.rent).toBe(1);
	});

	it("rejects negative rent on update", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			...LEASE_DATES,
			rent: 10_000_00,
			status: LEASE_STATUSES.TERMINATED,
		});
		const { lease } = clientsFor(ownerId);
		await expect(
			lease.updateLease({ id: leaseId, data: { rent: -50 } }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects shrinking the end date below the stored start on update", async () => {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			...LEASE_DATES,
			rent: 10_000_00,
			status: LEASE_STATUSES.TERMINATED,
		});
		const { lease } = clientsFor(ownerId);
		await expect(
			lease.updateLease({
				id: leaseId,
				data: {
					status: LEASE_STATUSES.ACTIVE,
					endDate: new Date("2025-06-01T00:00:00.000Z"),
				},
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("financial input invariants (B02) — units", () => {
	it("rejects non-positive base rent", async () => {
		const { ownerId, propertyId } = await createOwnerWithProperty();
		const { unit } = clientsFor(ownerId);
		await expect(
			unit.createUnit({
				propertyId,
				unitNumber: "B02-X",
				type: UNIT_TYPES.ONEBHK,
				baseRent: 0,
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects non-positive base rent on update", async () => {
		const { ownerId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const { unit } = clientsFor(ownerId);
		await expect(
			unit.updateUnit({ id: unitId, data: { baseRent: -1 } }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("financial input invariants (B02) — utilities", () => {
	async function createDirectLease() {
		const { ownerId, tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			...LEASE_DATES,
			rent: 10_000_00,
			status: LEASE_STATUSES.ACTIVE,
		});
		return { ownerId, leaseId };
	}

	const BILL = {
		utilityType: UTILITY_TYPES.ELECTRICITY,
		previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
		currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
		previousReading: 100,
		currentReading: 150,
		ratePerUnit: 9,
		fixedCharge: 100_00,
	};

	it("rejects negative charges and rates", async () => {
		const { ownerId, leaseId } = await createDirectLease();
		const { utility } = clientsFor(ownerId);
		await expect(
			utility.createUtility({
				leaseId,
				...BILL,
				fixedCharge: -1,
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
		await expect(
			utility.createUtility({
				leaseId,
				...BILL,
				ratePerUnit: -0.5,
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects a current reading below the previous reading", async () => {
		const { ownerId, leaseId } = await createDirectLease();
		const { utility } = clientsFor(ownerId);
		await expect(
			utility.createUtility({
				leaseId,
				...BILL,
				previousReading: 150,
				currentReading: 100,
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects a previous reading date after the current one", async () => {
		const { ownerId, leaseId } = await createDirectLease();
		const { utility } = clientsFor(ownerId);
		await expect(
			utility.createUtility({
				leaseId,
				...BILL,
				previousReadingDate: new Date("2026-09-15T00:00:00.000Z"),
				idempotencyKey: crypto.randomUUID(),
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("accepts boundary readings and equal period dates", async () => {
		const { ownerId, leaseId } = await createDirectLease();
		const { utility } = clientsFor(ownerId);
		const result = await utility.createUtility({
			leaseId,
			...BILL,
			previousReading: 0,
			currentReading: 0,
			previousReadingDate: BILL.currentReadingDate,
			idempotencyKey: crypto.randomUUID(),
		});
		createdUtilityIds.push(result.utility.id);
		expect(result.utility.totalAmount).toBeGreaterThanOrEqual(0);
	});

	it("rejects moving the previous reading date past the stored current date", async () => {
		const { ownerId, leaseId } = await createDirectLease();
		const { utility } = clientsFor(ownerId);
		const created = await utility.createUtility({
			leaseId,
			...BILL,
			idempotencyKey: crypto.randomUUID(),
		});
		createdUtilityIds.push(created.utility.id);
		await expect(
			utility.updateUtility({
				id: created.utility.id,
				data: {
					previousReadingDate: new Date("2026-09-15T00:00:00.000Z"),
				},
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("rejects a batch item with a decreasing reading", async () => {
		const { ownerId, leaseId } = await createDirectLease();
		const { utility } = clientsFor(ownerId);
		await expect(
			utility.createUtilityBatch({
				leaseId,
				batchId: generatedId(),
				items: [
					{
						...BILL,
						batchId: generatedId(),
						previousReading: 150,
						currentReading: 100,
						idempotencyKey: crypto.randomUUID(),
					},
				],
			}),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});
});

describe("financial input invariants (B02) — database", () => {
	async function unitFixture() {
		const { propertyId } = await createOwnerWithProperty();
		return createAvailableUnit(propertyId);
	}

	it("rejects non-positive base rent on units", async () => {
		const { propertyId } = await createOwnerWithProperty();
		await expect(
			db.insert(units).values({
				id: generatedId(),
				propertyId,
				unitNumber: "B02-DB",
				type: UNIT_TYPES.ONEBHK,
				baseRent: 0,
				status: UNIT_STATUSES.AVAILABLE,
			}),
		).rejects.toMatchObject({ cause: { code: "23514" } });
		const id = generatedId();
		createdUnitIds.push(id);
		await db.insert(units).values({
			id,
			propertyId,
			unitNumber: "B02-DB-OK",
			type: UNIT_TYPES.ONEBHK,
			baseRent: 1,
			status: UNIT_STATUSES.AVAILABLE,
		});
	});

	it("rejects invalid lease money, due day, and dates", async () => {
		const unitId = await unitFixture();
		const tenantId = createdUserIds[1] as string;
		const bad = [
			{ rent: 0, deposit: 0 },
			{ rent: 100, deposit: -1 },
			{ rent: 100, rentDueDate: 0 },
			{ rent: 100, rentDueDate: 32 },
			{
				rent: 100,
				startDate: LEASE_DATES.endDate,
				endDate: LEASE_DATES.startDate,
			},
		];
		for (const override of bad) {
			await expect(
				db.insert(leases).values({
					id: generatedId(),
					unitId,
					tenantId,
					startDate: LEASE_DATES.startDate,
					endDate: LEASE_DATES.endDate,
					rent: 100,
					deposit: 0,
					status: LEASE_STATUSES.ACTIVE,
					...override,
				}),
			).rejects.toMatchObject({ cause: { code: "23514" } });
		}
		const id = generatedId();
		await db.insert(leases).values({
			id,
			unitId,
			tenantId,
			startDate: LEASE_DATES.startDate,
			endDate: LEASE_DATES.startDate,
			rent: 1,
			deposit: 0,
			rentDueDate: 31,
			status: LEASE_STATUSES.ACTIVE,
		});
		createdLeaseIds.push(id);
	});

	it("rejects invalid agreement due day and dates", async () => {
		const { tenantId, propertyId } = await createOwnerWithProperty();
		for (const override of [
			{ rentDueDate: 32 },
			{
				startDate: LEASE_DATES.endDate,
				endDate: LEASE_DATES.startDate,
			},
		]) {
			await expect(
				db.insert(leaseAgreements).values({
					id: generatedId(),
					tenantId,
					propertyId,
					arrangementType: LEASE_AGREEMENT_ARRANGEMENT.INDEPENDENT,
					category: LEASE_CATEGORY.RESIDENTIAL,
					startDate: LEASE_DATES.startDate,
					endDate: LEASE_DATES.endDate,
					...override,
				}),
			).rejects.toMatchObject({ cause: { code: "23514" } });
		}
	});

	it("rejects invalid utility readings, charges, and periods", async () => {
		const { tenantId, propertyId } = await createOwnerWithProperty();
		const unitId = await createAvailableUnit(propertyId);
		const leaseId = crypto.randomUUID();
		createdLeaseIds.push(leaseId);
		await db.insert(leases).values({
			id: leaseId,
			unitId,
			tenantId,
			...LEASE_DATES,
			rent: 10_000_00,
			status: LEASE_STATUSES.ACTIVE,
		});
		const base = {
			id: generatedId(),
			leaseId,
			utilityType: UTILITY_TYPES.ELECTRICITY,
			previousReadingDate: new Date("2026-08-01T00:00:00.000Z"),
			currentReadingDate: new Date("2026-08-31T00:00:00.000Z"),
			previousReading: 100,
			currentReading: 150,
			ratePerUnit: 9,
			fixedCharge: 100_00,
			totalAmount: 5_00_00,
		};
		const bad = [
			{ fixedCharge: -1 },
			{ ratePerUnit: -0.5 },
			{ previousReading: -1 },
			{ currentReading: -1 },
			{ previousReading: 150, currentReading: 100 },
			{ previousReadingDate: new Date("2026-09-15T00:00:00.000Z") },
		];
		for (const override of bad) {
			await expect(
				db
					.insert(utilities)
					.values({ ...base, id: generatedId(), ...override }),
			).rejects.toMatchObject({ cause: { code: "23514" } });
		}
		const id = generatedId();
		await db.insert(utilities).values({ ...base, id });
		createdUtilityIds.push(id);
	});
});
