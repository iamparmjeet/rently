import { createDb } from "@rently/db";
import { user } from "@rently/db/schema/auth";
import { subscriptions } from "@rently/db/schema/subscription";
import { env } from "@rently/env/server";
import { inArray } from "drizzle-orm";
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

		const userIds = createdUsers.map((createdUser) => createdUser.id);

		if (userIds.length > 0) {
			await db
				.delete(subscriptions)
				.where(inArray(subscriptions.userId, userIds));

			await db.delete(user).where(inArray(user.id, userIds));
		}
	}

	createdEmails.length = 0;
	mocks.sendVerificationEmail.mockReset();
	mocks.sendPasswordResetEmail.mockReset();
	mocks.sendTenantSetupEmail.mockReset();
});

describe("email verification", () => {
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
