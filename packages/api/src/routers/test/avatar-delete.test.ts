// H07 avatar deletion. Per the AGENTS.md test rule, each case pins a
// Fix-Plan H07 acceptance contract. The defect: the server deleted the R2
// object but left user.image to a second client-side write, so any failure
// between the two left a visibly stale avatar (DB pointing at a deleted
// object). The server now clears user.image itself after the object is gone;
// a failed store delete keeps the reference so retry is safe.
import { createRouterClient } from "@orpc/server";
import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { env } from "@rently/env/server";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	getSession: vi.fn(),
}));

vi.mock("@rently/auth", () => ({
	auth: { api: { getSession: mocks.getSession } },
}));

import { deleteAvatar } from "../upload";

const db = createDb();

const createdUserIds: string[] = [];
const fetchCalls: Array<{ url: string; method: string }> = [];

function stubR2(behavior: "ok" | "error" | "throw") {
	vi.stubGlobal(
		"fetch",
		vi.fn(async (input: unknown) => {
			const request = input as Request;
			fetchCalls.push({ url: request.url, method: request.method });
			if (behavior === "throw") throw new Error("network down");
			return { ok: behavior === "ok", status: behavior === "ok" ? 204 : 500 };
		}),
	);
}

async function ownerWithAvatar() {
	const ownerId = crypto.randomUUID();
	createdUserIds.push(ownerId);
	const image = `${env.R2_PUBLIC_URL.replace(/\/$/, "")}/owners/${ownerId}/avatar?v=1`;
	await db.insert(user).values({
		id: ownerId,
		name: "H07 Owner",
		email: `${ownerId}@test.keyhq.invalid`,
		role: "owner",
		image,
	});
	mocks.getSession.mockResolvedValue({
		user: { id: ownerId, role: "owner", image },
		session: { id: "h07-session" },
	});
	const context = { db, headers: new Headers() } as never;
	return createRouterClient({ deleteAvatar }, { context });
}

async function storedImage(ownerId: string) {
	const [row] = await db
		.select({ image: user.image })
		.from(user)
		.where(eq(user.id, ownerId))
		.limit(1);
	return row?.image;
}

afterEach(async () => {
	if (createdUserIds.length > 0) {
		const ids = [...createdUserIds];
		createdUserIds.length = 0;
		for (const id of ids) {
			await db.delete(user).where(eq(user.id, id));
		}
	}
	fetchCalls.length = 0;
	vi.unstubAllGlobals();
	mocks.getSession.mockReset();
});

describe("H07 avatar deletion", () => {
	it("deletes the object and clears the stored reference", async () => {
		stubR2("ok");
		const api = await ownerWithAvatar();
		const ids = [...createdUserIds];
		const result = await api.deleteAvatar({});
		expect(result).toEqual({ success: true });
		expect(await storedImage(ids[0] as string)).toBeNull();
		expect(fetchCalls).toHaveLength(1);
		expect(fetchCalls[0]?.method).toBe("DELETE");
	});

	it("treats a missing object as success and still clears the reference", async () => {
		// S3 DELETE is idempotent (204 even when absent), so a missing object
		// follows the success path — no special code, pinned against regressions
		// that would 404 a re-delete after manual bucket cleanup.
		stubR2("ok");
		const api = await ownerWithAvatar();
		const ids = [...createdUserIds];
		await expect(api.deleteAvatar({})).resolves.toEqual({ success: true });
		expect(await storedImage(ids[0] as string)).toBeNull();
	});

	it("keeps the reference when storage fails so retry is safe", async () => {
		stubR2("error");
		const api = await ownerWithAvatar();
		const ids = [...createdUserIds];
		const before = await storedImage(ids[0] as string);
		await expect(api.deleteAvatar({})).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
		expect(await storedImage(ids[0] as string)).toBe(before);
	});

	it("keeps the reference when storage is unreachable so retry is safe", async () => {
		stubR2("throw");
		const api = await ownerWithAvatar();
		const ids = [...createdUserIds];
		const before = await storedImage(ids[0] as string);
		await expect(api.deleteAvatar({})).rejects.toMatchObject({
			code: "INTERNAL_SERVER_ERROR",
		});
		expect(await storedImage(ids[0] as string)).toBe(before);
	});

	it("is a no-op success when no avatar is stored", async () => {
		stubR2("ok");
		const api = await ownerWithAvatar();
		const ids = [...createdUserIds];
		await db
			.update(user)
			.set({ image: null })
			.where(eq(user.id, ids[0] as string));
		mocks.getSession.mockResolvedValue({
			user: { id: ids[0], role: "owner", image: null },
			session: { id: "h07-session" },
		});
		await expect(api.deleteAvatar({})).resolves.toEqual({ success: true });
		expect(fetchCalls).toHaveLength(0);
	});
});
