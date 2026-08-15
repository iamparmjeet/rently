import { resetPublicDemoWorkspace } from "@rently/api/modules/sample-workspace";
import { createDb } from "@rently/db";
import {
	BILLING_INTERVAL,
	PLAN_STATUS,
} from "@rently/db/constants/payment-constants";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";
import { account, user } from "@rently/db/schema/auth";
import { plans, subscriptions } from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import { env } from "@rently/env/server";
import { hashPassword } from "better-auth/crypto";
import { eq } from "drizzle-orm";

async function upsertDemoIdentity(options: {
	database: ReturnType<typeof createDb>;
	email: string;
	password: string;
	name: string;
	role: "owner" | "tenant";
}) {
	const { database, email, password, name, role } = options;
	const [existing] = await database
		.select()
		.from(user)
		.where(eq(user.email, email))
		.limit(1);
	if (existing?.accountMode === ACCOUNT_MODES.STANDARD) {
		throw new Error("Refusing to modify a standard account with a demo email.");
	}
	const id = existing?.id ?? generatedId();
	if (existing) {
		await database
			.update(user)
			.set({
				name,
				role,
				emailVerified: true,
				accountMode: ACCOUNT_MODES.PUBLIC_DEMO,
				workspaceMode: WORKSPACE_MODES.LIVE,
				sampleOwnerId: null,
			})
			.where(eq(user.id, id));
	} else {
		await database.insert(user).values({
			id,
			name,
			email,
			emailVerified: true,
			role,
			accountMode: ACCOUNT_MODES.PUBLIC_DEMO,
			workspaceMode: WORKSPACE_MODES.LIVE,
		});
	}
	const passwordHash = await hashPassword(password);
	const [credential] = await database
		.select({ id: account.id })
		.from(account)
		.where(eq(account.userId, id))
		.limit(1);
	if (credential) {
		await database
			.update(account)
			.set({ accountId: id, providerId: "credential", password: passwordHash })
			.where(eq(account.id, credential.id));
	} else {
		await database.insert(account).values({
			id: generatedId(),
			userId: id,
			accountId: id,
			providerId: "credential",
			password: passwordHash,
		});
	}
	return id;
}

async function main() {
	if (env.PUBLIC_DEMO_ENABLED !== "true")
		throw new Error(
			"PUBLIC_DEMO_ENABLED must be true to seed demo identities.",
		);
	if (
		!env.DEMO_OWNER_EMAIL ||
		!env.DEMO_OWNER_PASSWORD ||
		!env.DEMO_TENANT_EMAIL ||
		!env.DEMO_TENANT_PASSWORD
	)
		throw new Error("Demo credentials are missing.");
	const database = createDb();
	const ownerId = await upsertDemoIdentity({
		database,
		email: env.DEMO_OWNER_EMAIL,
		password: env.DEMO_OWNER_PASSWORD,
		name: "KeyHQ Demo Owner",
		role: USER_ROLES.OWNER,
	});
	const tenantId = await upsertDemoIdentity({
		database,
		email: env.DEMO_TENANT_EMAIL,
		password: env.DEMO_TENANT_PASSWORD,
		name: "Aarav Mehta",
		role: USER_ROLES.TENANT,
	});
	const [freePlan] = await database
		.select({ id: plans.id })
		.from(plans)
		.where(eq(plans.slug, "free"))
		.limit(1);
	if (!freePlan) throw new Error("Free plan is missing; run db:seed first.");
	const [demoSubscription] = await database
		.select({ id: subscriptions.id })
		.from(subscriptions)
		.where(eq(subscriptions.userId, ownerId))
		.limit(1);
	if (!demoSubscription)
		await database.insert(subscriptions).values({
			id: generatedId(),
			userId: ownerId,
			planId: freePlan.id,
			status: PLAN_STATUS.ACTIVE,
			billingInterval: BILLING_INTERVAL.MONTHLY,
			totalPaid: 0,
			expired: false,
		});
	await resetPublicDemoWorkspace({ database, ownerId, tenantId });
	console.log("Public demo identities and workspace are ready.");
}

main().catch((error) => {
	console.error(
		"Demo seed failed:",
		error instanceof Error ? error.message : error,
	);
	process.exit(1);
});
