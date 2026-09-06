// E04 GST profile invariant — regression rationale:
// `upsertOwnerProfile` accepts partial patches, but the validator only sees the
// patch while the handler merged it over the stored row without validating the
// merged result. That allowed GST-enabled profiles with no GSTIN (enable
// without a number, partial enable on a numberless profile, clearing the
// number while enabled) and stored blank GSTINs verbatim instead of NULL.
// Each test below maps to one of those invalid end states.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { user } from "@rently/db/schema/auth";
import { ownerProfiles } from "@rently/db/schema/schema";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import { upsertOwnerProfile } from "../rent/owner-profile";

const db = createDb();
const createdUserIds: string[] = [];
const createdOwnerProfileIds: string[] = [];

const VALID_GSTIN = "27ABCDE1234F1Z5";

async function createOwner(name: string) {
	const id = crypto.randomUUID();
	createdUserIds.push(id);
	await db.insert(user).values({
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role: USER_ROLES.OWNER,
	});
	return {
		id,
		name,
		email: `${id}@test.keyhq.invalid`,
		role: "owner" as const,
	};
}

function clientFor(authUser: { id: string; role: string }) {
	mocks.getSession.mockResolvedValue({
		user: authUser,
		session: { id: "test-session" },
	});
	return createRouterClient(
		{ upsertOwnerProfile },
		{ context: { db, headers: new Headers() } },
	);
}

async function seedProfile(
	ownerId: string,
	values: { gstNumber?: string | null; gstEnabled?: boolean },
) {
	const id = crypto.randomUUID();
	createdOwnerProfileIds.push(id);
	await db.insert(ownerProfiles).values({
		id,
		userId: ownerId,
		companyName: "GST Test Co",
		gstNumber: values.gstNumber ?? null,
		gstEnabled: values.gstEnabled ?? false,
	});
	return id;
}

async function getProfile(ownerId: string) {
	const [row] = await db
		.select()
		.from(ownerProfiles)
		.where(
			and(eq(ownerProfiles.userId, ownerId), isNull(ownerProfiles.deletedAt)),
		)
		.limit(1);
	return row ?? null;
}

afterEach(async () => {
	// Delete by owner: the upsert creates rows the id list never sees.
	if (createdUserIds.length > 0) {
		await db
			.delete(ownerProfiles)
			.where(inArray(ownerProfiles.userId, createdUserIds));
		await db.delete(user).where(inArray(user.id, createdUserIds));
	}
	createdOwnerProfileIds.length = 0;
	createdUserIds.length = 0;
	mocks.getSession.mockReset();
});

describe("E04 GST profile invariant", () => {
	it("rejects enabling GST without a GSTIN on a fresh profile and writes nothing", async () => {
		const owner = await createOwner("Fresh Owner");

		await expect(
			clientFor(owner).upsertOwnerProfile({ gstEnabled: true }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		expect(await getProfile(owner.id)).toBeNull();
	});

	it("rejects a partial enable on a stored numberless profile and leaves it disabled", async () => {
		const owner = await createOwner("Numberless Owner");
		await seedProfile(owner.id, { gstNumber: null, gstEnabled: false });

		await expect(
			clientFor(owner).upsertOwnerProfile({ gstEnabled: true }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const row = await getProfile(owner.id);
		expect(row?.gstEnabled).toBe(false);
	});

	it("rejects clearing the GSTIN while GST stays enabled and keeps the stored number", async () => {
		const owner = await createOwner("Clearing Owner");
		await seedProfile(owner.id, { gstNumber: VALID_GSTIN, gstEnabled: true });

		await expect(
			clientFor(owner).upsertOwnerProfile({ gstNumber: "" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });

		const row = await getProfile(owner.id);
		expect(row?.gstNumber).toBe(VALID_GSTIN);
		expect(row?.gstEnabled).toBe(true);
	});

	it("normalizes a blank GSTIN to NULL on a disabled profile", async () => {
		const owner = await createOwner("Blank Owner");
		await seedProfile(owner.id, { gstNumber: null, gstEnabled: false });

		const result = await clientFor(owner).upsertOwnerProfile({ gstNumber: "" });

		expect(result.profile.gstNumber).toBeNull();
		expect((await getProfile(owner.id))?.gstNumber).toBeNull();
	});

	it("allows enabling with a GSTIN supplied in the same patch", async () => {
		const owner = await createOwner("Same Patch Owner");

		const result = await clientFor(owner).upsertOwnerProfile({
			gstEnabled: true,
			gstNumber: VALID_GSTIN,
		});

		expect(result.profile.gstEnabled).toBe(true);
		expect(result.profile.gstNumber).toBe(VALID_GSTIN);
	});

	it("allows a partial enable when the stored profile already holds a GSTIN", async () => {
		const owner = await createOwner("Stored Number Owner");
		await seedProfile(owner.id, { gstNumber: VALID_GSTIN, gstEnabled: false });

		const result = await clientFor(owner).upsertOwnerProfile({
			gstEnabled: true,
		});

		expect(result.profile.gstEnabled).toBe(true);
		expect(result.profile.gstNumber).toBe(VALID_GSTIN);
	});

	it("allows disabling GST while retaining the stored GSTIN", async () => {
		const owner = await createOwner("Disabling Owner");
		await seedProfile(owner.id, { gstNumber: VALID_GSTIN, gstEnabled: true });

		const result = await clientFor(owner).upsertOwnerProfile({
			gstEnabled: false,
		});

		expect(result.profile.gstEnabled).toBe(false);
		expect(result.profile.gstNumber).toBe(VALID_GSTIN);
	});

	it("rejects a malformed GSTIN", async () => {
		const owner = await createOwner("Malformed Owner");

		await expect(
			clientFor(owner).upsertOwnerProfile({ gstNumber: "bogus" }),
		).rejects.toMatchObject({ code: "BAD_REQUEST" });
	});

	it("database refuses an enabled profile with no GSTIN", async () => {
		const owner = await createOwner("DB Guard Owner");
		const id = crypto.randomUUID();
		createdOwnerProfileIds.push(id);

		await expect(
			db.insert(ownerProfiles).values({
				id,
				userId: owner.id,
				companyName: "DB Guard Co",
				gstNumber: null,
				gstEnabled: true,
			}),
		).rejects.toMatchObject({ cause: { code: "23514" } });
	});

	it("database refuses an enabled profile with a blank GSTIN", async () => {
		const owner = await createOwner("DB Blank Owner");
		const id = crypto.randomUUID();
		createdOwnerProfileIds.push(id);

		await expect(
			db.insert(ownerProfiles).values({
				id,
				userId: owner.id,
				companyName: "DB Blank Co",
				gstNumber: "",
				gstEnabled: true,
			}),
		).rejects.toMatchObject({ cause: { code: "23514" } });
	});
});
