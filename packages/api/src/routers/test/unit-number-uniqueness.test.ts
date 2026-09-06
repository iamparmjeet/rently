// E09 live unit-number uniqueness — regression rationale:
// Nothing stopped two live units in one property from sharing a unitNumber,
// so bills, leases, and meter readings could name an ambiguous unit. The
// partial unique index on (property_id, unit_number) WHERE deleted_at IS NULL
// makes the database the arbiter (including races), while the API maps the
// 23505 collision to CONFLICT. The reuse test pins the approved semantics:
// archiving frees the number. Cross-property reuse is the scope control.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import {
	PROPERTY_TYPES,
	UNIT_TYPES,
} from "@rently/db/constants/rent-constants";
import { user } from "@rently/db/schema/auth";
import { properties, units } from "@rently/db/schema/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import { createUnit, deleteUnit, updateUnit } from "../rent/unit";

const db = createDb();

const createdUserIds: string[] = [];
const createdPropertyIds: string[] = [];
const createdUnitIds: string[] = [];

const RENT = 10_000_00;

async function ownerWithProperty(name = "Palm Residency") {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	await db.insert(user).values({
		id: ownerId,
		name: "Owner A",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
	});
	const propertyId = crypto.randomUUID();
	createdPropertyIds.push(propertyId);
	await db.insert(properties).values({
		id: propertyId,
		ownerId,
		name,
		address: "1 Palm Road, Mumbai",
		type: PROPERTY_TYPES.RESIDENTIAL,
	});
	return { ownerId, propertyId };
}

function clientFor(ownerId: string) {
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner" },
		session: { id: "test-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient(
		{ createUnit, updateUnit, deleteUnit },
		{ context },
	);
}

async function liveNumberCount(propertyId: string, unitNumber: string) {
	return db
		.select({ id: units.id })
		.from(units)
		.where(
			and(
				eq(units.propertyId, propertyId),
				eq(units.unitNumber, unitNumber),
				isNull(units.deletedAt),
			),
		);
}

function trackUnit(id: string) {
	if (!createdUnitIds.includes(id)) createdUnitIds.push(id);
}

afterEach(async () => {
	// Sweep units reachable from tracked properties too: red-state duplicate
	// creates succeed without returning a trackable id.
	if (createdPropertyIds.length > 0) {
		const strays = await db
			.select({ id: units.id })
			.from(units)
			.where(inArray(units.propertyId, createdPropertyIds));
		for (const stray of strays) trackUnit(stray.id);
	}
	if (createdUnitIds.length > 0) {
		await db.delete(units).where(inArray(units.id, createdUnitIds));
	}
	if (createdPropertyIds.length > 0) {
		await db
			.delete(properties)
			.where(inArray(properties.id, createdPropertyIds));
	}
	if (createdUserIds.length > 0) {
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdUnitIds.length = 0;
	createdPropertyIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("E09 live unit-number uniqueness", () => {
	it("refuses a duplicate live unit number in the same property", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const api = clientFor(ownerId);
		const first = await api.createUnit({
			propertyId,
			unitNumber: "E09-DUP",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(first.unit.id);

		await expect(
			api.createUnit({
				propertyId,
				unitNumber: "E09-DUP",
				type: UNIT_TYPES.ONEBHK,
				baseRent: RENT,
			}),
		).rejects.toMatchObject({ code: "CONFLICT" });

		expect(await liveNumberCount(propertyId, "E09-DUP")).toHaveLength(1);
	});

	it("allows the same number on a different property", async () => {
		const first = await ownerWithProperty("Palm Residency A");
		const second = await ownerWithProperty("Palm Residency B");
		const api = clientFor(first.ownerId);
		const created = await api.createUnit({
			propertyId: first.propertyId,
			unitNumber: "E09-SHARED",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(created.unit.id);
		const other = await clientFor(second.ownerId).createUnit({
			propertyId: second.propertyId,
			unitNumber: "E09-SHARED",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(other.unit.id);

		expect(other.unit.unitNumber).toBe("E09-SHARED");
	});

	it("frees the number once the unit is archived", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const api = clientFor(ownerId);
		const first = await api.createUnit({
			propertyId,
			unitNumber: "E09-REUSE",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(first.unit.id);
		await api.deleteUnit({ id: first.unit.id });

		const reused = await api.createUnit({
			propertyId,
			unitNumber: "E09-REUSE",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(reused.unit.id);

		expect(await liveNumberCount(propertyId, "E09-REUSE")).toHaveLength(1);
	});

	it("refuses renaming a unit onto a live sibling number", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const api = clientFor(ownerId);
		const first = await api.createUnit({
			propertyId,
			unitNumber: "E09-KEEP",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(first.unit.id);
		const second = await api.createUnit({
			propertyId,
			unitNumber: "E09-MOVE",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		});
		trackUnit(second.unit.id);

		await expect(
			api.updateUnit({ id: second.unit.id, data: { unitNumber: "E09-KEEP" } }),
		).rejects.toMatchObject({ code: "CONFLICT" });

		const [row] = await db
			.select({ unitNumber: units.unitNumber })
			.from(units)
			.where(eq(units.id, second.unit.id));
		expect(row?.unitNumber).toBe("E09-MOVE");
	});

	it("refuses a raw duplicate insert at the database boundary", async () => {
		const { propertyId } = await ownerWithProperty();
		const firstId = crypto.randomUUID();
		trackUnit(firstId);
		await db.insert(units).values({
			id: firstId,
			propertyId,
			unitNumber: "E09-DB",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
			status: "available",
		});

		const attempt = db.insert(units).values({
			id: crypto.randomUUID(),
			propertyId,
			unitNumber: "E09-DB",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
			status: "available",
		});
		let code: unknown;
		try {
			await attempt;
		} catch (error) {
			const top = error as { code?: unknown; cause?: { code?: unknown } };
			code = top.code ?? top.cause?.code;
		}
		expect(code).toBe("23505");
		expect(await liveNumberCount(propertyId, "E09-DB")).toHaveLength(1);
	});

	it("lets exactly one of two concurrent duplicate creates succeed", async () => {
		const { ownerId, propertyId } = await ownerWithProperty();
		const api = clientFor(ownerId);
		const payload = {
			propertyId,
			unitNumber: "E09-RACE",
			type: UNIT_TYPES.ONEBHK,
			baseRent: RENT,
		} as const;
		const results = await Promise.allSettled([
			api.createUnit({ ...payload }),
			api.createUnit({ ...payload }),
		]);
		const fulfilled = results.filter((r) => r.status === "fulfilled");
		const rejected = results.filter((r) => r.status === "rejected");
		for (const result of fulfilled) trackUnit(result.value.unit.id);

		expect(fulfilled).toHaveLength(1);
		expect(rejected).toHaveLength(1);
		expect(rejected[0]).toMatchObject({ reason: { code: "CONFLICT" } });
		expect(await liveNumberCount(propertyId, "E09-RACE")).toHaveLength(1);
	});
});
