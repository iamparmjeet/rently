import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { tenantInvites, tenantProfiles } from "@rently/db/schema/schema";
import { subscriptions } from "@rently/db/schema/subscription";
import { env } from "@rently/env/server";
import { eq, inArray, or } from "drizzle-orm";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sendVerificationEmail: vi.fn(),
	sendPasswordResetEmail: vi.fn(),
	sendTenantSetupEmail: vi.fn(),
}));

vi.mock("@rently/email", () => ({
	sendVerificationEmail: mocks.sendVerificationEmail,
	sendPasswordResetEmail: mocks.sendPasswordResetEmail,
	sendTenantSetupEmail: mocks.sendTenantSetupEmail,
}));

import { auth } from "@rently/auth";

const db = createDb();
const createdEmails: string[] = [];
const createdInviteIds: string[] = [];
const createdOwnerIds: string[] = [];

function authRequest(path: string, body: unknown) {
	return auth.handler(
		new Request(new URL(path, env.BETTER_AUTH_URL), {
			method: "POST",
			headers: {
				"content-type": "application/json",
				origin: env.WEB_APP_URL,
			},
			body: JSON.stringify(body),
		}),
	);
}

afterEach(async () => {
	if (createdEmails.length > 0) {
		const createdUsers = await db
			.select({ id: user.id })
			.from(user)
			.where(inArray(user.email, createdEmails));

		const userIds = [
			...createdUsers.map((createdUser) => createdUser.id),
			...createdOwnerIds,
		];

		if (userIds.length > 0) {
			await db
				.delete(tenantProfiles)
				.where(
					or(
						inArray(tenantProfiles.userId, userIds),
						inArray(tenantProfiles.invitedId, createdInviteIds),
					),
				);

			if (createdInviteIds.length > 0) {
				await db
					.delete(tenantInvites)
					.where(inArray(tenantInvites.id, createdInviteIds));
			}

			await db
				.delete(subscriptions)
				.where(inArray(subscriptions.userId, userIds));

			await db.delete(user).where(inArray(user.id, userIds));
		}
	}

	createdEmails.length = 0;
	createdInviteIds.length = 0;
	createdOwnerIds.length = 0;
	mocks.sendVerificationEmail.mockReset();
	mocks.sendPasswordResetEmail.mockReset();
	mocks.sendTenantSetupEmail.mockReset();
});

describe("email verification", () => {
	it("claims the newest valid pending invitation during signup", async () => {
		const ownerId = crypto.randomUUID();
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const now = new Date();
		const expiresAt = new Date(now.getTime() + 60 * 60 * 1000);
		const oldCreatedAt = new Date(now.getTime() - 3 * 60 * 1000);
		const newestPendingCreatedAt = new Date(now.getTime() - 60 * 1000);

		createdOwnerIds.push(ownerId);
		createdEmails.push(email);

		await db.insert(user).values({
			id: ownerId,
			name: "D05 Owner",
			email: `${ownerId}@test.keyhq.invalid`,
			role: "owner",
		});

		const [accepted, newestPending] = await db
			.insert(tenantInvites)
			.values([
				{
					name: "Accepted Tenant",
					email,
					token: crypto.randomUUID(),
					expiresAt,
					invitedById: ownerId,
					status: "accepted",
					createdAt: oldCreatedAt,
				},
				{
					name: "Newest Pending Tenant",
					email,
					token: crypto.randomUUID(),
					expiresAt,
					invitedById: ownerId,
					status: "pending",
					createdAt: newestPendingCreatedAt,
				},
			])
			.returning();

		if (!accepted || !newestPending) {
			throw new Error("Failed to create D05 invitation fixtures");
		}
		createdInviteIds.push(accepted.id, newestPending.id);

		const response = await authRequest("/api/auth/sign-up/email", {
			email,
			name: "D05 Tenant",
			password: "ValidPassword1",
			callbackURL: `${env.WEB_APP_URL}/callback`,
		});

		expect(response.status).toBe(200);

		const [createdUser] = await db
			.select({ id: user.id, role: user.role })
			.from(user)
			.where(eq(user.email, email));
		expect(createdUser?.role).toBe("tenant");

		const [profile] = await db
			.select({ invitedId: tenantProfiles.invitedId })
			.from(tenantProfiles)
			.where(eq(tenantProfiles.userId, createdUser?.id ?? ""));
		expect(profile?.invitedId).toBe(newestPending.id);

		const [storedAccepted, storedNewestPending] = await db
			.select({ id: tenantInvites.id, status: tenantInvites.status })
			.from(tenantInvites)
			.where(
				or(
					eq(tenantInvites.id, accepted.id),
					eq(tenantInvites.id, newestPending.id),
				),
			)
			.orderBy(tenantInvites.createdAt);
		expect(storedAccepted).toEqual({ id: accepted.id, status: "accepted" });
		expect(storedNewestPending).toEqual({
			id: newestPending.id,
			status: "accepted",
		});
	});

	it("sends a verification email after password signup", async () => {
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const callbackURL = `${env.WEB_APP_URL}/callback`;

		createdEmails.push(email);

		const response = await authRequest("/api/auth/sign-up/email", {
			email,
			name: "Verification Test Owner",
			password: "ValidPassword1",
			callbackURL,
		});

		expect(response.status).toBe(200);
		expect(mocks.sendVerificationEmail).toHaveBeenCalledOnce();
		expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
			to: email,
			name: "Verification Test Owner",
			verificationUrl: expect.stringContaining("/api/auth/verify-email"),
		});

		const [{ verificationUrl }] =
			mocks.sendVerificationEmail.mock.calls[0] ?? [];

		expect(new URL(verificationUrl).searchParams.get("callbackURL")).toBe(
			callbackURL,
		);
	});

	it("blocks unverified password login and sends another verification email", async () => {
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const password = "ValidPassword1";

		createdEmails.push(email);

		const signupResponse = await authRequest("/api/auth/sign-up/email", {
			email,
			name: "Unverified Login Test Owner",
			password,
			callbackURL: `${env.WEB_APP_URL}/callback`,
		});

		expect(signupResponse.status).toBe(200);

		mocks.sendVerificationEmail.mockClear();

		const signInResponse = await authRequest("/api/auth/sign-in/email", {
			email,
			password,
		});

		expect(signInResponse.status).toBe(403);
		expect(mocks.sendVerificationEmail).toHaveBeenCalledOnce();
		expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
			to: email,
			name: "Unverified Login Test Owner",
			verificationUrl: expect.stringContaining("/api/auth/verify-email"),
		});
	});

	it("verifies the email and create a session after the link is opened", async () => {
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const callbackURL = `${env.WEB_APP_URL}/callback`;

		createdEmails.push(email);

		const signupResponse = await authRequest("/api/auth/sign-up/email", {
			email,
			name: "Verification Link Test Owner",
			password: "ValidPassword1",
			callbackURL,
		});

		expect(signupResponse.status).toBe(200);

		const [{ verificationUrl }] =
			mocks.sendVerificationEmail.mock.calls[0] ?? [];

		const verificationResponse = await auth.handler(
			new Request(verificationUrl, {
				headers: {
					origin: env.WEB_APP_URL,
				},
			}),
		);

		expect(verificationResponse.status).toBeGreaterThanOrEqual(300);
		expect(verificationResponse.status).toBeLessThan(400);
		expect(verificationResponse.headers.get("location")).toBe(callbackURL);

		const setCookie = verificationResponse.headers.get("set-cookie");
		expect(setCookie).toContain("rently");

		const sessionCookie = setCookie?.split(";")[0];

		if (!sessionCookie) {
			throw new Error("Verification response did not create a session cookie.");
		}

		const sessionResponse = await auth.handler(
			new Request(new URL("/api/auth/get-session", env.BETTER_AUTH_URL), {
				headers: {
					cookie: sessionCookie,
				},
			}),
		);

		expect(sessionResponse.status).toBe(200);
		const session = await sessionResponse.json();

		expect(session.user).toMatchObject({
			email,
			emailVerified: true,
		});
	});

	it("send another verification email when explicitly requested", async () => {
		const email = `${crypto.randomUUID()}@test.keyhq.invalid`;
		const callbackURL = `${env.WEB_APP_URL}/callback?callbackUrl=%2Fdashboard`;

		createdEmails.push(email);

		const signupResponse = await authRequest("/api/auth/sign-up/email", {
			email,
			name: "Resend Test Owner",
			password: "ValidPassword1",
			callbackURL,
		});

		expect(signupResponse.status).toBe(200);

		mocks.sendVerificationEmail.mockClear();

		const resendResponse = await authRequest(
			"/api/auth/send-verification-email",
			{
				email,
				callbackURL,
			},
		);

		expect(resendResponse.status).toBe(200);
		expect(mocks.sendVerificationEmail).toHaveBeenCalledOnce();

		const [{ verificationUrl }] =
			mocks.sendVerificationEmail.mock.calls[0] ?? [];

		expect(new URL(verificationUrl).searchParams.get("callbackURL")).toBe(
			callbackURL,
		);
	});
});
