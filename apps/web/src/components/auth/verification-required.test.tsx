// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	sendVerificationEmail: vi.fn(),
}));

vi.mock("@/lib/auth-client", () => ({
	authClient: {
		sendVerificationEmail: mocks.sendVerificationEmail,
	},
}));

import { VerificationRequired } from "./verification-required";

const email = "owner@test.keyhq.invalid";
const verificationCallbackUrl =
	"https://web.keyhq.test/callback?callbackUrl=https%3A%2F%2Fdashboard.keyhq.test%2Fdashboard";

afterEach(() => {
	cleanup();
	mocks.sendVerificationEmail.mockReset();
});

describe("VerificationRequired", () => {
	it("shows sending and sent feedback after a successful resend", async () => {
		let resolveRequest: ((value: { error: null }) => void) | undefined;

		mocks.sendVerificationEmail.mockImplementationOnce(
			() =>
				new Promise((resolve) => {
					resolveRequest = resolve;
				}),
		);

		const user = userEvent.setup();

		render(
			<VerificationRequired
				email={email}
				verificationCallbackUrl={verificationCallbackUrl}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Resend verification email",
			}),
		);

		await waitFor(() => {
			expect(
				screen.getByRole("button", {
					name: "Sending…",
				}),
			).toBeDefined();
		});

		expect(mocks.sendVerificationEmail).toHaveBeenCalledWith({
			email,
			callbackURL: verificationCallbackUrl,
		});

		if (!resolveRequest) {
			throw new Error("Resend request was not started.");
		}

		resolveRequest({ error: null });

		expect(
			await screen.findByText("A new verification email has been sent."),
		).toBeDefined();
	});

	it("shows generic feedback when resend fails", async () => {
		mocks.sendVerificationEmail.mockResolvedValueOnce({
			error: { message: "Provider failure" },
		});

		const user = userEvent.setup();

		render(
			<VerificationRequired
				email={email}
				verificationCallbackUrl={verificationCallbackUrl}
			/>,
		);

		await user.click(
			screen.getByRole("button", {
				name: "Resend verification email",
			}),
		);

		expect(
			await screen.findByText(
				"We could not send another email. Please try again.",
			),
		).toBeDefined();
	});

	it("preserves a safe return URL on the sign-in link", () => {
		const safeCallbackUrl =
			"https://dashboard.keyhq.test/properties?view=active";

		render(
			<VerificationRequired
				email={email}
				verificationCallbackUrl={verificationCallbackUrl}
				safeCallbackUrl={safeCallbackUrl}
			/>,
		);

		expect(
			screen
				.getByRole("link", {
					name: "Back to sign in",
				})
				.getAttribute("href"),
		).toBe(`/login?callbackUrl=${encodeURIComponent(safeCallbackUrl)}`);
	});
});
