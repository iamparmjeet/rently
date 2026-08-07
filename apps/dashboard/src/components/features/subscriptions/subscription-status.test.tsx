// @vitest-environment jsdom

import type { SubscriptionWithPlan } from "@rently/validators";
import { cleanup, render, screen } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SubscriptionStatus } from "./subscription-status";

afterEach(() => {
	cleanup();
	vi.useRealTimers();
});

const now = new Date("2026-08-07T00:00:00.000Z");

const starterPlan = {
	id: "0198f281-9240-7000-8000-000000000001",
	name: "Starter",
	slug: "free",
	description: "Free · Up to 10 active tenants",
	tenantLimit: 10,
	priceMonthly: 0,
	priceQuarterly: 0,
	priceHalfYearly: 0,
	priceYearly: 0,
	priceTwoYear: 0,
	discountQuarterly: 500,
	discountHalfYearly: 100,
	discountYearly: 150,
	discountTwoYear: 200,
	createdAt: now,
	updatedAt: now,
};

const proPlan = {
	...starterPlan,
	id: "0198f281-9240-7000-8000-000000000002",
	name: "Pro",
	slug: "pro",
	description: "Up to 500 active tenants · Priority support",
	tenantLimit: 500,
	priceMonthly: 49_900,
};

function makeSubscription(
	overrides: Partial<SubscriptionWithPlan> = {},
): SubscriptionWithPlan {
	return {
		id: "0198f281-9240-7000-8000-000000000003",
		userId: "0198f281-9240-7000-8000-000000000004",
		planId: starterPlan.id,
		status: "active",
		currentPeriodStart: now,
		currentPeriodEnd: null,
		nextBillingDate: null,
		trialEndsAt: null,
		expired: false,
		billingInterval: "monthly",
		totalPaid: 0,
		currency: "inr",
		createdAt: now,
		updatedAt: now,
		plan: starterPlan,
		...overrides,
	};
}

function renderStatus(
	subscription: SubscriptionWithPlan | null,
	showPlan = false,
) {
	render(
		createElement(SubscriptionStatus, {
			subscription,
			showPlan,
		}),
	);
}

describe("SubscriptionStatus", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(now);
	});

	it("shows the free plan and active state in compact plan mode", () => {
		renderStatus(makeSubscription(), true);

		expect(screen.getByText("Starter · Active")).toBeTruthy();
	});

	it("shows a paid plan and active state", () => {
		renderStatus(
			makeSubscription({
				plan: proPlan,
				planId: proPlan.id,
			}),
			true,
		);

		expect(screen.getByText("Pro · Active")).toBeTruthy();
	});

	it("shows trial and expiry details with the plan name", () => {
		renderStatus(
			makeSubscription({
				plan: proPlan,
				planId: proPlan.id,
				status: "trial",
				trialEndsAt: new Date("2026-08-19T00:00:00.000Z"),
			}),
			true,
		);

		expect(screen.getByText("Pro · Trial · 12d left")).toBeTruthy();

		cleanup();
		renderStatus(
			makeSubscription({
				plan: proPlan,
				planId: proPlan.id,
				currentPeriodEnd: new Date("2026-08-12T00:00:00.000Z"),
			}),
			true,
		);

		expect(screen.getByText("Pro · Expiring in 5d")).toBeTruthy();
	});

	it("shows cancelled and paused states", () => {
		renderStatus(
			makeSubscription({
				plan: proPlan,
				planId: proPlan.id,
				status: "cancelled",
			}),
			true,
		);

		expect(screen.getByText("Pro · Cancelled")).toBeTruthy();

		cleanup();
		renderStatus(
			makeSubscription({
				plan: proPlan,
				planId: proPlan.id,
				status: "paused",
			}),
			true,
		);

		expect(screen.getByText("Pro · Paused")).toBeTruthy();
	});

	it("shows Free · Active when the subscription row is absent", () => {
		renderStatus(null, true);

		expect(screen.getByText("Free · Active")).toBeTruthy();
	});

	it("preserves the shorter page-level labels by default", () => {
		renderStatus(makeSubscription());
		expect(screen.getByText("Free")).toBeTruthy();

		cleanup();
		renderStatus(
			makeSubscription({
				plan: proPlan,
				planId: proPlan.id,
			}),
		);

		expect(screen.getByText("Active")).toBeTruthy();
	});
});
