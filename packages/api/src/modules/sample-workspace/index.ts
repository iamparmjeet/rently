import { ORPCError } from "@orpc/server";
import {
	type Database,
	type NeonHttpDatabase,
	supportsDatabaseBatch,
} from "@rently/db";
import {
	ACCOUNT_MODES,
	WORKSPACE_MODES,
} from "@rently/db/constants/workspace-modes";
import { account, session, user } from "@rently/db/schema/auth";
import {
	documentUpdateRequests,
	leases,
	notificationPreferences,
	notifications,
	payments,
	properties,
	rentReminderSuppressions,
	scheduledEmailDeliveries,
	tenantDocuments,
	tenantInvites,
	tenantProfiles,
	units,
	utilities,
} from "@rently/db/schema/schema";
import { invoices, subscriptions } from "@rently/db/schema/subscription";
import { generatedId } from "@rently/db/utils/id";
import { and, eq, inArray } from "drizzle-orm";
import { type WorkspaceCapabilities, workspaceCapabilities } from "./policy";

export type WorkspaceExperience = {
	mode: "live" | "registered_sample" | "public_demo";
	persona: "owner" | "tenant" | null;
	canLoadSample: boolean;
	samplePreviouslyUsed: boolean;
	nextPublicResetAt: Date | null;
	capabilities: WorkspaceCapabilities;
};

export type ResetResult = {
	ownerId: string;
	properties: number;
	tenants: number;
};
export type RepairResult = { repaired: boolean; persona: "owner" | "tenant" };

export const PUBLIC_DEMO_IDS = {
	propertyResidential: "0195f000-0000-7000-8000-000000000001",
	propertyCommercial: "0195f000-0000-7000-8000-000000000002",
	units: [
		"0195f000-0000-7000-8000-000000000011",
		"0195f000-0000-7000-8000-000000000012",
		"0195f000-0000-7000-8000-000000000013",
		"0195f000-0000-7000-8000-000000000014",
		"0195f000-0000-7000-8000-000000000015",
		"0195f000-0000-7000-8000-000000000016",
	],
	tenants: [
		"0195f000-0000-7000-8000-000000000021",
		"0195f000-0000-7000-8000-000000000022",
		"0195f000-0000-7000-8000-000000000023",
		"0195f000-0000-7000-8000-000000000024",
	],
	profiles: [
		"0195f000-0000-7000-8000-000000000031",
		"0195f000-0000-7000-8000-000000000032",
		"0195f000-0000-7000-8000-000000000033",
		"0195f000-0000-7000-8000-000000000034",
	],
	leases: [
		"0195f000-0000-7000-8000-000000000041",
		"0195f000-0000-7000-8000-000000000042",
		"0195f000-0000-7000-8000-000000000043",
		"0195f000-0000-7000-8000-000000000044",
	],
};

function nextResetBoundary(now: Date): Date {
	const next = new Date(now);
	next.setUTCSeconds(0, 0);
	next.setUTCMinutes(now.getUTCMinutes() < 30 ? 30 : 60);
	return next;
}

type ExperienceUser = {
	id: string;
	role?: string | null;
	accountMode?: string | null;
	workspaceMode?: string | null;
	sampleWorkspaceUsedAt?: Date | null;
};

export async function getWorkspaceExperience(options: {
	database: Database;
	user: ExperienceUser;
	now?: Date;
}): Promise<WorkspaceExperience> {
	const { database, user: currentUser } = options;
	const now = options.now ?? new Date();
	const isPublic = currentUser.accountMode === ACCOUNT_MODES.PUBLIC_DEMO;
	const isSample = currentUser.workspaceMode === WORKSPACE_MODES.SAMPLE;
	let canLoadSample = false;
	if (
		currentUser.role === "owner" &&
		currentUser.accountMode === ACCOUNT_MODES.STANDARD &&
		currentUser.workspaceMode === WORKSPACE_MODES.LIVE &&
		currentUser.sampleWorkspaceUsedAt == null
	) {
		const [property] = await database
			.select({ id: properties.id })
			.from(properties)
			.where(eq(properties.ownerId, currentUser.id))
			.limit(1);
		const [invite] = await database
			.select({ id: tenantInvites.id })
			.from(tenantInvites)
			.where(eq(tenantInvites.invitedById, currentUser.id))
			.limit(1);
		const [syntheticTenant] = await database
			.select({ id: user.id })
			.from(user)
			.where(eq(user.sampleOwnerId, currentUser.id))
			.limit(1);
		canLoadSample = !property && !invite && !syntheticTenant;
	}
	return {
		mode: isPublic ? "public_demo" : isSample ? "registered_sample" : "live",
		persona: isPublic
			? currentUser.role === "tenant"
				? "tenant"
				: "owner"
			: null,
		canLoadSample,
		samplePreviouslyUsed: currentUser.sampleWorkspaceUsedAt != null,
		nextPublicResetAt: isPublic ? nextResetBoundary(now) : null,
		capabilities: workspaceCapabilities(currentUser),
	};
}

type SeedIds = {
	propertyResidential: string;
	propertyCommercial: string;
	units: string[];
	tenants: string[];
	profiles: string[];
	leases: string[];
};

function seedIds(isPublic: boolean): SeedIds {
	return isPublic
		? {
				...PUBLIC_DEMO_IDS,
				units: [...PUBLIC_DEMO_IDS.units],
				tenants: [...PUBLIC_DEMO_IDS.tenants],
				profiles: [...PUBLIC_DEMO_IDS.profiles],
				leases: [...PUBLIC_DEMO_IDS.leases],
			}
		: {
				propertyResidential: generatedId(),
				propertyCommercial: generatedId(),
				units: Array.from({ length: 6 }, generatedId),
				tenants: Array.from({ length: 4 }, generatedId),
				profiles: Array.from({ length: 4 }, generatedId),
				leases: Array.from({ length: 4 }, generatedId),
			};
}

function startOfMonth(now: Date): Date {
	return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

function addMonths(date: Date, months: number): Date {
	return new Date(
		Date.UTC(
			date.getUTCFullYear(),
			date.getUTCMonth() + months,
			date.getUTCDate(),
		),
	);
}

function at<T>(items: readonly T[], index: number): T {
	const value = items[index];
	if (value === undefined) throw new Error("Sample preset is incomplete.");
	return value;
}

async function seedPortfolio(options: {
	database: Database;
	ownerId: string;
	now: Date;
	isPublic: boolean;
	fixedTenantId?: string;
	minimumTenantOnly?: boolean;
}): Promise<{ properties: number; tenants: number }> {
	const { database, ownerId, now, isPublic, fixedTenantId, minimumTenantOnly } =
		options;
	const ids = seedIds(isPublic);
	if (fixedTenantId) ids.tenants[0] = fixedTenantId;
	const month = startOfMonth(now);
	const tenants = [
		["Aarav Mehta", "aarav.mehta@keyhq-demo.invalid"],
		["Diya Nair", "diya.nair@keyhq-demo.invalid"],
		["Kabir Shah", "kabir.shah@keyhq-demo.invalid"],
		["Meera Iyer", "meera.iyer@keyhq-demo.invalid"],
	] as const;
	const tenantCount = minimumTenantOnly ? 1 : 4;
	const tenantRows = tenants
		.slice(0, tenantCount)
		.map(([name, email], index) => ({
			id: at(ids.tenants, index),
			name,
			email: isPublic ? email : email.replace("@", `.${ownerId.slice(0, 8)}@`),
			emailVerified: true,
			role: "tenant" as const,
			accountMode:
				isPublic && index === 0
					? ACCOUNT_MODES.PUBLIC_DEMO
					: ACCOUNT_MODES.SAMPLE_IDENTITY,
			sampleOwnerId: ownerId,
		}));
	await database
		.insert(user)
		.values(tenantRows)
		.onConflictDoUpdate({
			target: user.id,
			set: {
				name: user.name,
				accountMode: user.accountMode,
				sampleOwnerId: user.sampleOwnerId,
			},
		});
	const propertyRows = [
		{
			id: ids.propertyResidential,
			ownerId,
			name: "Maple Residency",
			address: "14 Lake View Road, Pune, Maharashtra",
			type: "residential" as const,
			yearBuilt: "2018",
			floors: "4",
			description: "Fictional family apartment building.",
		},
		{
			id: ids.propertyCommercial,
			ownerId,
			name: "Harbour Square",
			address: "22 Market Lane, Bengaluru, Karnataka",
			type: "commercial" as const,
			yearBuilt: "2020",
			floors: "2",
			description: "Fictional neighbourhood retail spaces.",
		},
	];
	await database
		.insert(properties)
		.values(minimumTenantOnly ? propertyRows.slice(0, 1) : propertyRows)
		.onConflictDoUpdate({
			target: properties.id,
			set: {
				name: properties.name,
				address: properties.address,
				deletedAt: null,
			},
		});
	const unitRows = [
		{
			id: ids.units[0],
			propertyId: ids.propertyResidential,
			unitNumber: "A-101",
			type: "2BHK" as const,
			baseRent: 280000,
			status: "occupied" as const,
			furnishing: "semi_furnished" as const,
		},
		{
			id: ids.units[1],
			propertyId: ids.propertyResidential,
			unitNumber: "A-102",
			type: "2BHK" as const,
			baseRent: 300000,
			status: "occupied" as const,
			furnishing: "fully_furnished" as const,
		},
		{
			id: ids.units[2],
			propertyId: ids.propertyResidential,
			unitNumber: "B-201",
			type: "1BHK" as const,
			baseRent: 1500000,
			status: "occupied" as const,
			furnishing: "unfurnished" as const,
		},
		{
			id: ids.units[3],
			propertyId: ids.propertyResidential,
			unitNumber: "B-202",
			type: "1BHK" as const,
			baseRent: 1600000,
			status: "available" as const,
			furnishing: "unfurnished" as const,
		},
		{
			id: ids.units[4],
			propertyId: ids.propertyCommercial,
			unitNumber: "S-01",
			type: "shop" as const,
			baseRent: 5000000,
			status: "occupied" as const,
			furnishing: "unfurnished" as const,
		},
		{
			id: ids.units[5],
			propertyId: ids.propertyCommercial,
			unitNumber: "S-02",
			type: "shop" as const,
			baseRent: 4500000,
			status: "available" as const,
			furnishing: "unfurnished" as const,
		},
	];
	const selectedUnits = minimumTenantOnly ? unitRows.slice(0, 1) : unitRows;
	await database
		.insert(units)
		.values(selectedUnits)
		.onConflictDoUpdate({
			target: units.id,
			set: { status: units.status, deletedAt: null },
		});
	const profileRows = tenantRows.map((tenant, index) => ({
		id: at(ids.profiles, index),
		userId: tenant.id,
		email: tenant.email,
		phone: `90000000${index}`,
		address: index === 0 ? "A-101, Maple Residency" : "Demo address",
		verificationStatus: "verified" as const,
		createdById: ownerId,
	}));
	await database
		.insert(tenantProfiles)
		.values(profileRows)
		.onConflictDoUpdate({
			target: tenantProfiles.id,
			set: { email: tenantProfiles.email, deletedAt: null },
		});
	const rents = [280000, 300000, 1500000, 5000000] as const;
	const leaseRows = tenantRows.map((tenant, index) => {
		const rent = at(rents, index);
		return {
			id: at(ids.leases, index),
			unitId: at(ids.units, index === 3 ? 4 : index),
			tenantId: tenant.id,
			startDate: addMonths(month, -11),
			endDate: index === 2 ? addMonths(month, 1) : addMonths(month, 12),
			rent,
			deposit: rent * 2,
			status: "active" as const,
			rentDueDate: index === 2 ? 1 : 5,
			notice: 30,
		};
	});
	await database
		.insert(leases)
		.values(leaseRows)
		.onConflictDoUpdate({
			target: leases.id,
			set: { endDate: leases.endDate, status: leases.status },
		});
	const paymentRows = leaseRows.flatMap((lease, leaseIndex) => {
		const history = Array.from({ length: 12 }, (_, monthIndex) => {
			const period = addMonths(month, monthIndex - 11);
			const isCurrent = monthIndex === 11;
			const amount =
				isCurrent && leaseIndex === 1
					? Math.floor(lease.rent / 2)
					: isCurrent && leaseIndex === 2
						? 0
						: lease.rent;
			return amount === 0
				? []
				: [
						{
							id: generatedId(),
							leaseId: lease.id,
							amount,
							paymentDate: new Date(period.getTime() + 2 * 86400000),
							type: "rent" as const,
							paymentMethods: "upi" as const,
							description: "Demo rent payment",
						},
					];
		});
		return [
			{
				id: generatedId(),
				leaseId: lease.id,
				amount: lease.deposit ?? 0,
				paymentDate: addMonths(month, -11),
				type: "deposit" as const,
				paymentMethods: "bank_transfer" as const,
				description: "Refundable security deposit",
			},
			...history.flat(),
		];
	});
	await database.insert(payments).values(paymentRows);
	const utilityRows = leaseRows
		.slice(0, minimumTenantOnly ? 1 : 3)
		.flatMap((lease, index) => [
			{
				id: generatedId(),
				leaseId: lease.id,
				utilityType: "electricity" as const,
				previousReadingDate: addMonths(month, -1),
				currentReadingDate: month,
				previousReading: 1200 + index * 50,
				currentReading: 1300 + index * 50,
				unitsUsed: 100,
				// Monetary fields are stored in paise: ₹8.50 per unit.
				ratePerUnit: 850,
				fixedCharge: 15000,
				totalAmount: 100000,
				isPaid: index === 0,
			},
			{
				id: generatedId(),
				leaseId: lease.id,
				utilityType:
					index === 1 ? ("water" as const) : ("maintenance" as const),
				currentReadingDate: month,
				previousReading: 0,
				currentReading: 0,
				totalAmount: 50000,
				isPaid: index !== 2,
			},
		]);
	await database.insert(utilities).values(utilityRows);
	if (!minimumTenantOnly) {
		await database.insert(tenantInvites).values({
			id: generatedId(),
			name: "Rohan Kapoor",
			email: "rohan.kapoor@keyhq-demo.invalid",
			token: generatedId(),
			invitedById: ownerId,
			status: "pending",
			deliveryStatus: "suppressed",
			expiresAt: addMonths(month, 1),
		});
	}
	await database
		.insert(notificationPreferences)
		.values({ ownerId })
		.onConflictDoNothing({ target: notificationPreferences.ownerId });
	await database.insert(notifications).values({
		userId: ownerId,
		type: "lease_expiring_soon",
		title: "Lease expiring soon",
		message: "A demo lease expires next month.",
		entityId: ids.leases[2],
		entityType: "lease",
	});
	return { properties: minimumTenantOnly ? 1 : 2, tenants: tenantCount };
}

async function cleanupOwnerGraph(
	database: Database,
	ownerId: string,
	keepPublicTenantId?: string,
) {
	const propertyRows = await database
		.select({ id: properties.id })
		.from(properties)
		.where(eq(properties.ownerId, ownerId));
	const propertyIds = propertyRows.map((row) => row.id);
	const unitRows = propertyIds.length
		? await database
				.select({ id: units.id })
				.from(units)
				.where(inArray(units.propertyId, propertyIds))
		: [];
	const unitIds = unitRows.map((row) => row.id);
	const leaseRows = unitIds.length
		? await database
				.select({ id: leases.id })
				.from(leases)
				.where(inArray(leases.unitId, unitIds))
		: [];
	const leaseIds = leaseRows.map((row) => row.id);
	const profileRows = await database
		.select({ id: tenantProfiles.id })
		.from(tenantProfiles)
		.where(eq(tenantProfiles.createdById, ownerId));
	const profileIds = profileRows.map((row) => row.id);
	const sampleUsers = await database
		.select({ id: user.id })
		.from(user)
		.where(
			and(
				eq(user.accountMode, ACCOUNT_MODES.SAMPLE_IDENTITY),
				eq(user.sampleOwnerId, ownerId),
			),
		);
	const sampleUserIds = sampleUsers.map((row) => row.id);
	const statements: unknown[] = [];
	if (profileIds.length) {
		statements.push(
			database
				.update(tenantDocuments)
				.set({ supersedesDocumentId: null, updateRequestId: null })
				.where(inArray(tenantDocuments.tenantProfileId, profileIds)),
		);
		statements.push(
			database
				.delete(documentUpdateRequests)
				.where(inArray(documentUpdateRequests.tenantProfileId, profileIds)),
		);
		statements.push(
			database
				.delete(tenantDocuments)
				.where(inArray(tenantDocuments.tenantProfileId, profileIds)),
		);
	}
	if (leaseIds.length) {
		statements.push(
			database
				.delete(scheduledEmailDeliveries)
				.where(inArray(scheduledEmailDeliveries.leaseId, leaseIds)),
		);
		statements.push(
			database
				.delete(rentReminderSuppressions)
				.where(inArray(rentReminderSuppressions.leaseId, leaseIds)),
		);
		statements.push(
			database.delete(payments).where(inArray(payments.leaseId, leaseIds)),
		);
		statements.push(
			database.delete(utilities).where(inArray(utilities.leaseId, leaseIds)),
		);
		statements.push(
			database.delete(leases).where(inArray(leases.id, leaseIds)),
		);
	}
	if (profileIds.length)
		statements.push(
			database
				.delete(tenantProfiles)
				.where(inArray(tenantProfiles.id, profileIds)),
		);
	statements.push(
		database
			.delete(tenantInvites)
			.where(eq(tenantInvites.invitedById, ownerId)),
	);
	if (unitIds.length)
		statements.push(database.delete(units).where(inArray(units.id, unitIds)));
	if (propertyIds.length)
		statements.push(
			database.delete(properties).where(inArray(properties.id, propertyIds)),
		);
	statements.push(
		database.delete(notifications).where(eq(notifications.userId, ownerId)),
	);
	if (sampleUserIds.length) {
		statements.push(
			database.delete(invoices).where(inArray(invoices.userId, sampleUserIds)),
		);
		statements.push(
			database
				.delete(subscriptions)
				.where(inArray(subscriptions.userId, sampleUserIds)),
		);
		statements.push(
			database.delete(session).where(inArray(session.userId, sampleUserIds)),
		);
		statements.push(
			database.delete(account).where(inArray(account.userId, sampleUserIds)),
		);
		statements.push(
			database.delete(user).where(inArray(user.id, sampleUserIds)),
		);
	}
	if (statements.length) {
		if (supportsDatabaseBatch(database))
			await database.batch(
				statements as unknown as Parameters<NeonHttpDatabase["batch"]>[0],
			);
		else
			await database.transaction(async () => {
				for (const statement of statements as { execute(): Promise<unknown> }[])
					await statement.execute();
			});
	}
	// A fixed demo tenant is an identity, not a synthetic sample user. Its profile
	// is reset above and recreated by seedPortfolio, while its account stays intact.
	void keepPublicTenantId;
}

export {
	assertPrivateDocumentsAllowed,
	isNonLiveWorkspace,
	workspaceCapabilities,
} from "./policy";

export async function loadRegisteredSampleWorkspace(options: {
	database: Database;
	owner: ExperienceUser;
	now?: Date;
}): Promise<WorkspaceExperience> {
	const { database, owner } = options;
	const experience = await getWorkspaceExperience({
		database,
		user: owner,
		now: options.now,
	});
	if (!experience.canLoadSample)
		throw new ORPCError("CONFLICT", {
			message: owner.sampleWorkspaceUsedAt
				? "SAMPLE_ALREADY_USED"
				: "SAMPLE_NOT_ELIGIBLE",
		});
	const now = options.now ?? new Date();
	await seedPortfolio({ database, ownerId: owner.id, now, isPublic: false });
	await database
		.update(user)
		.set({ workspaceMode: WORKSPACE_MODES.SAMPLE, sampleWorkspaceUsedAt: now })
		.where(eq(user.id, owner.id));
	const [updated] = await database
		.select()
		.from(user)
		.where(eq(user.id, owner.id))
		.limit(1);
	if (!updated)
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Workspace could not be loaded.",
		});
	return getWorkspaceExperience({ database, user: updated, now });
}

export async function clearRegisteredSampleWorkspace(options: {
	database: Database;
	owner: ExperienceUser;
}): Promise<WorkspaceExperience> {
	const { database, owner } = options;
	if (
		owner.accountMode !== ACCOUNT_MODES.STANDARD ||
		owner.workspaceMode !== WORKSPACE_MODES.SAMPLE
	)
		throw new ORPCError("CONFLICT", { message: "NOT_SAMPLE_WORKSPACE" });
	await cleanupOwnerGraph(database, owner.id);
	await database
		.delete(notificationPreferences)
		.where(eq(notificationPreferences.ownerId, owner.id));
	await database
		.update(user)
		.set({ workspaceMode: WORKSPACE_MODES.LIVE })
		.where(eq(user.id, owner.id));
	const [updated] = await database
		.select()
		.from(user)
		.where(eq(user.id, owner.id))
		.limit(1);
	if (!updated)
		throw new ORPCError("INTERNAL_SERVER_ERROR", {
			message: "Workspace could not be cleared.",
		});
	return getWorkspaceExperience({ database, user: updated });
}

export async function resetPublicDemoWorkspace(options: {
	database: Database;
	ownerId: string;
	tenantId?: string;
	now?: Date;
}): Promise<ResetResult> {
	const now = options.now ?? new Date();
	await cleanupOwnerGraph(options.database, options.ownerId, options.tenantId);
	const result = await seedPortfolio({
		database: options.database,
		ownerId: options.ownerId,
		fixedTenantId: options.tenantId,
		now,
		isPublic: true,
	});
	return { ownerId: options.ownerId, ...result };
}

export async function repairPublicDemoPersona(options: {
	database: Database;
	ownerId: string;
	tenantId: string;
	persona: "owner" | "tenant";
	now?: Date;
}): Promise<RepairResult> {
	const { database, ownerId, tenantId, persona } = options;
	const [showcase] = await database
		.select({ id: properties.id })
		.from(properties)
		.where(eq(properties.id, PUBLIC_DEMO_IDS.propertyResidential))
		.limit(1);
	if (persona === "owner") {
		if (!showcase)
			await resetPublicDemoWorkspace({
				database,
				ownerId,
				tenantId,
				now: options.now,
			});
		return { repaired: !showcase, persona };
	}
	const [anchorLease] = await database
		.select({ id: leases.id })
		.from(leases)
		.where(eq(leases.id, at(PUBLIC_DEMO_IDS.leases, 0)))
		.limit(1);
	if (!anchorLease) {
		await seedPortfolio({
			database,
			ownerId,
			fixedTenantId: tenantId,
			now: options.now ?? new Date(),
			isPublic: true,
			minimumTenantOnly: true,
		});
	}
	return { repaired: !anchorLease, persona };
}
