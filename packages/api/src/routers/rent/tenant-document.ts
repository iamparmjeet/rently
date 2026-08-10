import { ORPCError } from "@orpc/server";
import { type Database, supportsDatabaseBatch } from "@rently/db";
import {
	ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES,
	DOCUMENT_CONSENT_SOURCES,
	KEYHQ_DOCUMENT_CONSENT_VERSION,
	SUBMISSION_SOURCES,
	TENANT_DOCUMENT_CONSENT_SECONDS,
	TENANT_DOCUMENT_DOWNLOAD_URL_TTL_SECONDS,
	TENANT_DOCUMENT_MAX_BYTES,
	TENANT_DOCUMENT_RETENTION_SECONDS,
	TENANT_DOCUMENT_STATUSES,
	TENANT_DOCUMENT_TYPE_VALUES,
	TENANT_DOCUMENT_TYPES,
	TENANT_DOCUMENT_UPDATE_WINDOW_SECONDS,
	TENANT_DOCUMENT_UPLOAD_SESSION_SECONDS,
	TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS,
	type TenantDocumentType,
} from "@rently/db/constants/tenant-document-constants";
import {
	documentUpdateRequests,
	tenantDocuments,
	tenantProfiles,
} from "@rently/db/schema/schema";
import { generatedId } from "@rently/db/utils/id";
import { env } from "@rently/env/server";
import {
	AllowedTenantDocumentContentTypeSchema,
	type TenantDocumentCapabilitiesSchema,
	TenantDocumentListSchema,
	type TenantDocumentSummarySchema,
	TenantDocumentTypeSchema,
} from "@rently/validators";
import { and, desc, eq, gt, inArray, max, or } from "drizzle-orm";
import z from "zod";
import type { TenantDocumentStorage } from "../../modules/tenant-documents/storage";
import { createR2TenantDocumentStorage } from "../../modules/tenant-documents/storage";
import {
	ownerProcedure,
	protectedProcedure,
	tenantProcedure,
} from "../../procedures";

const documentStorage = createR2TenantDocumentStorage;

const initialTargetSchema = z.object({ kind: z.literal("initial") });
const replacementTargetSchema = z.object({
	kind: z.literal("replacement"),
	requestId: z.uuid(),
});

const beginUploadInput = z.object({
	tenantId: z.uuid().optional(),
	documentType: TenantDocumentTypeSchema,
	contentType: AllowedTenantDocumentContentTypeSchema,
	sizeBytes: z.number().int().min(1).max(TENANT_DOCUMENT_MAX_BYTES),
	target: z.union([initialTargetSchema, replacementTargetSchema]),
});

const documentIdInput = z.object({
	documentId: z.uuid(),
	disposition: z.enum(["inline", "attachment"]).default("attachment"),
});

const uploadOutput = z.object({
	documentId: z.uuid(),
	uploadUrl: z.url(),
	expiresAt: z.date(),
	requiredHeaders: z.object({
		"Content-Type": AllowedTenantDocumentContentTypeSchema,
		"Content-Disposition": z.string(),
		"Cache-Control": z.literal("private, no-store"),
	}),
});

const listOutput = TenantDocumentListSchema;

const submitOutput = z.object({ success: z.boolean() });

const capabilities = (): z.infer<typeof TenantDocumentCapabilitiesSchema> => ({
	maxBytes: TENANT_DOCUMENT_MAX_BYTES,
	allowedContentTypes: [...ALLOWED_TENANT_DOCUMENT_CONTENT_TYPES],
	uploadUrlTtlSeconds: TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS,
	downloadUrlTtlSeconds: TENANT_DOCUMENT_DOWNLOAD_URL_TTL_SECONDS,
	documentTypes: TENANT_DOCUMENT_TYPE_VALUES.map((type) => ({
		type,
		enabled:
			type !== TENANT_DOCUMENT_TYPES.AADHAAR ||
			env.AADHAAR_UPLOADS_ENABLED === "true",
		disabledReason:
			type === TENANT_DOCUMENT_TYPES.AADHAAR &&
			env.AADHAAR_UPLOADS_ENABLED !== "true"
				? "Aadhaar uploads are disabled until the compliance review is complete."
				: null,
	})),
});

function fail(
	code: string,
	status: "BAD_REQUEST" | "CONFLICT" | "NOT_FOUND",
): never {
	throw new ORPCError(status, { message: code });
}

function isOwner(authUser: { role?: string | null }): boolean {
	return authUser.role === "owner";
}

async function createPendingDocument(
	db: Database,
	values: typeof tenantDocuments.$inferInsert,
	requestId: string | null,
	now: Date,
): Promise<void> {
	if (supportsDatabaseBatch(db)) {
		if (requestId) {
			await db.batch([
				db.insert(tenantDocuments).values(values),
				db
					.update(documentUpdateRequests)
					.set({ replacementDocumentId: values.id, updatedAt: now })
					.where(
						and(
							eq(documentUpdateRequests.id, requestId),
							eq(documentUpdateRequests.status, "approved"),
						),
					),
			]);
			return;
		}
		await db.batch([db.insert(tenantDocuments).values(values)]);
		return;
	}

	await db.transaction(async (tx) => {
		await tx.insert(tenantDocuments).values(values);
		if (requestId) {
			await tx
				.update(documentUpdateRequests)
				.set({ replacementDocumentId: values.id, updatedAt: now })
				.where(
					and(
						eq(documentUpdateRequests.id, requestId),
						eq(documentUpdateRequests.status, "approved"),
					),
				);
		}
	});
}

async function findProfileForActor(
	db: Database,
	authUser: { id: string; role?: string | null },
	tenantId?: string,
) {
	const requestedTenantId = tenantId ?? authUser.id;
	const [profile] = await db
		.select({
			id: tenantProfiles.id,
			userId: tenantProfiles.userId,
			ownerId: tenantProfiles.createdById,
			aadhaarLastFour: tenantProfiles.aadhaarLastFour,
		})
		.from(tenantProfiles)
		.where(
			and(
				eq(tenantProfiles.userId, requestedTenantId),
				isOwner(authUser)
					? eq(tenantProfiles.createdById, authUser.id)
					: eq(tenantProfiles.userId, authUser.id),
			),
		)
		.limit(1);
	if (!profile) fail("NOT_FOUND", "NOT_FOUND");
	if (!profile.ownerId) fail("NOT_FOUND", "NOT_FOUND");
	return profile;
}

async function findDocumentForActor(
	db: Database,
	authUser: { id: string; role?: string | null },
	documentId: string,
) {
	const [row] = await db
		.select({
			document: tenantDocuments,
			profile: {
				id: tenantProfiles.id,
				userId: tenantProfiles.userId,
				ownerId: tenantProfiles.createdById,
			},
		})
		.from(tenantDocuments)
		.innerJoin(
			tenantProfiles,
			eq(tenantDocuments.tenantProfileId, tenantProfiles.id),
		)
		.where(
			and(
				eq(tenantDocuments.id, documentId),
				isOwner(authUser)
					? eq(tenantDocuments.ownerId, authUser.id)
					: eq(tenantProfiles.userId, authUser.id),
			),
		)
		.limit(1);
	if (!row) fail("NOT_FOUND", "NOT_FOUND");
	return row;
}

async function findRequestsByDocumentIds(db: Database, ids: string[]) {
	if (ids.length === 0)
		return new Map<string, typeof documentUpdateRequests.$inferSelect>();
	const rows = await db
		.select()
		.from(documentUpdateRequests)
		.where(
			or(
				inArray(documentUpdateRequests.sourceDocumentId, ids),
				inArray(documentUpdateRequests.replacementDocumentId, ids),
			),
		)
		.orderBy(desc(documentUpdateRequests.createdAt));
	const result = new Map<string, typeof documentUpdateRequests.$inferSelect>();
	for (const row of rows) {
		if (!result.has(row.sourceDocumentId))
			result.set(row.sourceDocumentId, row);
		if (row.replacementDocumentId && !result.has(row.replacementDocumentId))
			result.set(row.replacementDocumentId, row);
	}
	return result;
}

function summarize(
	doc: typeof tenantDocuments.$inferSelect,
	request: typeof documentUpdateRequests.$inferSelect | null,
): z.infer<typeof TenantDocumentSummarySchema> {
	return {
		id: doc.id,
		documentType: doc.documentType,
		version: doc.version,
		status: doc.status,
		contentType: doc.contentType,
		sizeBytes: doc.sizeBytes,
		identifierHint: doc.identifierHint,
		submissionSource: doc.submissionSource,
		submittedAt: doc.submittedAt,
		consentExpiresAt: doc.consentExpiresAt,
		reviewedAt: doc.reviewedAt,
		reviewNote: doc.reviewNote,
		purgeAfter: doc.purgeAfter,
		purgedAt: doc.purgedAt,
		updateRequest: request
			? {
					id: request.id,
					sourceDocumentId: request.sourceDocumentId,
					reason: request.reason,
					status: request.status,
					ownerNote: request.ownerNote,
					approvedExpiresAt: request.approvedExpiresAt,
					submittedAt: request.submittedAt,
					consentedAt: request.consentedAt,
				}
			: null,
	};
}

async function listDocuments(db: Database, profileId: string) {
	const documents = await db
		.select()
		.from(tenantDocuments)
		.where(eq(tenantDocuments.tenantProfileId, profileId))
		.orderBy(desc(tenantDocuments.createdAt));
	const requests = await findRequestsByDocumentIds(
		db,
		documents.map((doc: typeof tenantDocuments.$inferSelect) => doc.id),
	);
	return documents.map((doc: typeof tenantDocuments.$inferSelect) =>
		summarize(doc, requests.get(doc.id) ?? null),
	);
}

async function assertEnabled(documentType: TenantDocumentType): Promise<void> {
	if (
		documentType === TENANT_DOCUMENT_TYPES.AADHAAR &&
		env.AADHAAR_UPLOADS_ENABLED !== "true"
	) {
		fail("AADHAAR_UPLOAD_DISABLED", "BAD_REQUEST");
	}
}

async function verifyUploadedObject(
	storage: TenantDocumentStorage,
	doc: typeof tenantDocuments.$inferSelect,
): Promise<{ etag: string; sizeBytes: number }> {
	const object = await storage.headObject(doc.storageKey);
	if (!object) fail("DOCUMENT_OBJECT_MISSING", "BAD_REQUEST");
	if (
		object.contentType !== doc.contentType ||
		object.sizeBytes === null ||
		object.sizeBytes <= 0 ||
		object.sizeBytes > TENANT_DOCUMENT_MAX_BYTES ||
		object.sizeBytes !== doc.sizeBytes ||
		!object.etag
	) {
		await storage.deleteObject(doc.storageKey);
		throw new ORPCError("BAD_REQUEST", {
			message: "DOCUMENT_METADATA_MISMATCH",
		});
	}
	return { etag: object.etag, sizeBytes: object.sizeBytes };
}

function validateAadhaarSubmission(input: {
	documentType: TenantDocumentType;
	aadhaarLastFour?: string;
	maskedAadhaarConfirmed?: true;
}) {
	if (input.documentType !== TENANT_DOCUMENT_TYPES.AADHAAR) return;
	if (!/^\d{4}$/.test(input.aadhaarLastFour ?? "")) {
		fail("BAD_REQUEST", "BAD_REQUEST");
	}
	if (input.maskedAadhaarConfirmed !== true) {
		fail("DOCUMENT_CONSENT_REQUIRED", "BAD_REQUEST");
	}
}

export const listMyDocuments = tenantProcedure
	.route({ method: "GET", path: "/rent/tenant-document/my-list" })
	.output(listOutput)
	.handler(async ({ context }) => {
		const profile = await findProfileForActor(context.db, context.user);
		return {
			documents: await listDocuments(context.db, profile.id),
			capabilities: capabilities(),
		};
	});

export const listTenantDocuments = ownerProcedure
	.route({ method: "GET", path: "/rent/tenant-document/list" })
	.input(z.object({ tenantId: z.uuid() }))
	.output(listOutput)
	.handler(async ({ context, input }) => {
		const profile = await findProfileForActor(
			context.db,
			context.user,
			input.tenantId,
		);
		return {
			documents: await listDocuments(context.db, profile.id),
			capabilities: capabilities(),
		};
	});

export const beginTenantDocumentUpload = protectedProcedure
	.route({ method: "POST", path: "/rent/tenant-document/begin-upload" })
	.input(beginUploadInput)
	.output(uploadOutput)
	.handler(async ({ context, input }) => {
		const owner = isOwner(context.user);
		if (owner && !input.tenantId) fail("NOT_FOUND", "NOT_FOUND");
		const profile = await findProfileForActor(
			context.db,
			context.user,
			input.tenantId,
		);
		await assertEnabled(input.documentType);
		const now = new Date();
		let request: typeof documentUpdateRequests.$inferSelect | null = null;
		if (input.target.kind === "replacement") {
			const rows = await context.db
				.select()
				.from(documentUpdateRequests)
				.where(
					and(
						eq(documentUpdateRequests.id, input.target.requestId),
						eq(documentUpdateRequests.tenantProfileId, profile.id),
						eq(documentUpdateRequests.status, "approved"),
						gt(documentUpdateRequests.approvedExpiresAt, now),
					),
				)
				.limit(1);
			request = rows[0] ?? null;
			if (!request) fail("DOCUMENT_UPDATE_WINDOW_EXPIRED", "CONFLICT");
		} else {
			const [active] = await context.db
				.select({ id: tenantDocuments.id })
				.from(tenantDocuments)
				.where(
					and(
						eq(tenantDocuments.tenantProfileId, profile.id),
						eq(tenantDocuments.documentType, input.documentType),
						inArray(tenantDocuments.status, [
							TENANT_DOCUMENT_STATUSES.UPLOAD_PENDING,
							TENANT_DOCUMENT_STATUSES.AWAITING_TENANT_CONSENT,
							TENANT_DOCUMENT_STATUSES.PENDING_REVIEW,
							TENANT_DOCUMENT_STATUSES.OWNER_REVIEWED,
						]),
					),
				)
				.limit(1);
			if (active) fail("DOCUMENT_ALREADY_PENDING", "CONFLICT");
		}

		const [versionRow] = await context.db
			.select({ version: max(tenantDocuments.version) })
			.from(tenantDocuments)
			.where(
				and(
					eq(tenantDocuments.tenantProfileId, profile.id),
					eq(tenantDocuments.documentType, input.documentType),
				),
			);
		const version = Number(versionRow?.version ?? 0) + 1;
		const documentId = generatedId();
		const ownerId = profile.ownerId;
		if (!ownerId) fail("NOT_FOUND", "NOT_FOUND");
		const storage = documentStorage();
		const signed = await storage.createUploadUrl({
			ownerId,
			tenantProfileId: profile.id,
			documentId,
			documentType: input.documentType,
			contentType: input.contentType,
			version,
		});
		const uploadExpiresAt = new Date(
			now.getTime() + TENANT_DOCUMENT_UPLOAD_SESSION_SECONDS * 1000,
		);
		await createPendingDocument(
			context.db,
			{
				id: documentId,
				tenantProfileId: profile.id,
				ownerId,
				documentType: input.documentType,
				version,
				supersedesDocumentId: request?.sourceDocumentId ?? null,
				updateRequestId: request?.id ?? null,
				status: TENANT_DOCUMENT_STATUSES.UPLOAD_PENDING,
				storageKey: signed.storageKey,
				contentType: input.contentType,
				sizeBytes: input.sizeBytes,
				submissionSource: owner
					? SUBMISSION_SOURCES.OWNER
					: SUBMISSION_SOURCES.TENANT,
				submittedById: context.user.id,
				uploadExpiresAt,
				consentSource: request
					? DOCUMENT_CONSENT_SOURCES.TENANT_UPDATE_REQUEST
					: null,
				consentVersion: request ? KEYHQ_DOCUMENT_CONSENT_VERSION : null,
				consentedById: request?.requestedById ?? null,
				consentedAt: request?.consentedAt ?? null,
				consentExpiresAt: request?.approvedExpiresAt ?? null,
			},
			request?.id ?? null,
			now,
		);
		return {
			documentId,
			uploadUrl: signed.uploadUrl,
			expiresAt: signed.expiresAt,
			requiredHeaders: signed.requiredHeaders,
		};
	});

const submitInput = z.object({
	documentId: z.uuid(),
	consentAccepted: z.literal(true).optional(),
	aadhaarLastFour: z.string().optional(),
	maskedAadhaarConfirmed: z.literal(true).optional(),
});

export const submitInitialDocument = protectedProcedure
	.route({ method: "POST", path: "/rent/tenant-document/submit-initial" })
	.input(submitInput)
	.output(submitOutput)
	.handler(async ({ context, input }) => {
		const row = await findDocumentForActor(
			context.db,
			context.user,
			input.documentId,
		);
		const doc = row.document;
		const storage = documentStorage();
		if (
			doc.status !== TENANT_DOCUMENT_STATUSES.UPLOAD_PENDING ||
			doc.updateRequestId
		) {
			fail("CONFLICT", "CONFLICT");
		}
		if (doc.uploadExpiresAt <= new Date()) {
			await storage.deleteObject(doc.storageKey).catch(() => undefined);
			await context.db
				.update(tenantDocuments)
				.set({ status: TENANT_DOCUMENT_STATUSES.EXPIRED })
				.where(eq(tenantDocuments.id, doc.id));
			fail("DOCUMENT_UPLOAD_EXPIRED", "CONFLICT");
		}
		if (!isOwner(context.user) && input.consentAccepted !== true)
			fail("DOCUMENT_CONSENT_REQUIRED", "BAD_REQUEST");
		validateAadhaarSubmission({
			documentType: doc.documentType,
			aadhaarLastFour: input.aadhaarLastFour,
			maskedAadhaarConfirmed: input.maskedAadhaarConfirmed,
		});
		let metadata: { etag: string; sizeBytes: number };
		try {
			metadata = await verifyUploadedObject(storage, doc);
		} catch (error) {
			if (
				error instanceof ORPCError &&
				error.message === "DOCUMENT_METADATA_MISMATCH"
			) {
				await context.db
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.EXPIRED,
						updatedAt: new Date(),
					})
					.where(eq(tenantDocuments.id, doc.id));
			}
			throw error;
		}
		const now = new Date();
		if (isOwner(context.user)) {
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.AWAITING_TENANT_CONSENT,
					etag: metadata.etag,
					identifierHint:
						doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR
							? input.aadhaarLastFour
							: null,
					maskedAadhaarConfirmed:
						doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR ? true : null,
					submittedAt: now,
					consentExpiresAt: new Date(
						now.getTime() + TENANT_DOCUMENT_CONSENT_SECONDS * 1000,
					),
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, doc.id));
		} else {
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.PENDING_REVIEW,
					etag: metadata.etag,
					identifierHint:
						doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR
							? input.aadhaarLastFour
							: null,
					maskedAadhaarConfirmed:
						doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR ? true : null,
					submittedAt: now,
					consentSource: DOCUMENT_CONSENT_SOURCES.TENANT_DIRECT_UPLOAD,
					consentVersion: KEYHQ_DOCUMENT_CONSENT_VERSION,
					consentedById: context.user.id,
					consentedAt: now,
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, doc.id));
		}
		return { success: true };
	});

export const confirmOwnerSubmittedDocument = tenantProcedure
	.route({ method: "POST", path: "/rent/tenant-document/confirm-owner-upload" })
	.input(
		z.object({
			documentId: z.uuid(),
			decision: z.enum(["confirm", "decline"]),
			consentAccepted: z.literal(true).optional(),
		}),
	)
	.output(submitOutput)
	.handler(async ({ context, input }) => {
		const row = await findDocumentForActor(
			context.db,
			context.user,
			input.documentId,
		);
		if (
			row.document.status !== TENANT_DOCUMENT_STATUSES.AWAITING_TENANT_CONSENT
		)
			fail("CONFLICT", "CONFLICT");
		if (input.decision === "confirm") {
			if (input.consentAccepted !== true)
				fail("DOCUMENT_CONSENT_REQUIRED", "BAD_REQUEST");
			const now = new Date();
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.PENDING_REVIEW,
					consentSource: DOCUMENT_CONSENT_SOURCES.TENANT_CONFIRMED_OWNER_UPLOAD,
					consentVersion: KEYHQ_DOCUMENT_CONSENT_VERSION,
					consentedById: context.user.id,
					consentedAt: now,
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, input.documentId));
		} else {
			const now = new Date();
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.REJECTED,
					reviewNote: "Tenant declined this owner-submitted document.",
					purgeAfter: new Date(
						now.getTime() + TENANT_DOCUMENT_RETENTION_SECONDS * 1000,
					),
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, input.documentId));
		}
		return { success: true };
	});

export const reviewTenantDocument = ownerProcedure
	.route({ method: "POST", path: "/rent/tenant-document/review" })
	.input(
		z.object({
			documentId: z.uuid(),
			decision: z.enum(["approve", "reject"]),
			note: z.string().trim().optional(),
			maskedAadhaarConfirmed: z.literal(true).optional(),
		}),
	)
	.output(submitOutput)
	.handler(async ({ context, input }) => {
		const row = await findDocumentForActor(
			context.db,
			context.user,
			input.documentId,
		);
		const doc = row.document;
		if (doc.status !== TENANT_DOCUMENT_STATUSES.PENDING_REVIEW)
			fail("CONFLICT", "CONFLICT");
		if (input.decision === "reject" && !input.note)
			fail("BAD_REQUEST", "BAD_REQUEST");
		const now = new Date();
		if (input.decision === "reject") {
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.REJECTED,
					reviewedById: context.user.id,
					reviewedAt: now,
					reviewNote: input.note,
					purgeAfter: new Date(
						now.getTime() + TENANT_DOCUMENT_RETENTION_SECONDS * 1000,
					),
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, doc.id));
			return { success: true };
		}
		if (
			doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR &&
			(!/^\d{4}$/.test(doc.identifierHint ?? "") ||
				doc.maskedAadhaarConfirmed !== true ||
				input.maskedAadhaarConfirmed !== true)
		)
			fail("BAD_REQUEST", "BAD_REQUEST");
		const [request] = doc.updateRequestId
			? await context.db
					.select()
					.from(documentUpdateRequests)
					.where(eq(documentUpdateRequests.id, doc.updateRequestId))
					.limit(1)
			: [];
		if (doc.updateRequestId && request?.status !== "submitted")
			fail("CONFLICT", "CONFLICT");

		const updateReplacement = (database: Database) =>
			database
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.OWNER_REVIEWED,
					reviewedById: context.user.id,
					reviewedAt: now,
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, doc.id));
		const updateAadhaarLastFour = (database: Database) =>
			database
				.update(tenantProfiles)
				.set({ aadhaarLastFour: doc.identifierHint, updatedAt: now })
				.where(eq(tenantProfiles.id, row.profile.id));

		if (supportsDatabaseBatch(context.db)) {
			if (request) {
				const supersedeSource = context.db
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.SUPERSEDED,
						purgeAfter: new Date(
							now.getTime() + TENANT_DOCUMENT_RETENTION_SECONDS * 1000,
						),
						updatedAt: now,
					})
					.where(eq(tenantDocuments.id, request.sourceDocumentId));
				const completeRequest = context.db
					.update(documentUpdateRequests)
					.set({
						status: "completed",
						completedAt: now,
						reviewedById: context.user.id,
						reviewedAt: now,
						updatedAt: now,
					})
					.where(eq(documentUpdateRequests.id, request.id));
				if (doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR) {
					await context.db.batch([
						supersedeSource,
						updateReplacement(context.db),
						completeRequest,
						updateAadhaarLastFour(context.db),
					]);
				} else {
					await context.db.batch([
						supersedeSource,
						updateReplacement(context.db),
						completeRequest,
					]);
				}
			} else if (doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR) {
				await context.db.batch([
					updateReplacement(context.db),
					updateAadhaarLastFour(context.db),
				]);
			} else {
				await context.db.batch([updateReplacement(context.db)]);
			}
			return { success: true };
		}

		await context.db.transaction(async (tx) => {
			if (request) {
				await tx
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.SUPERSEDED,
						purgeAfter: new Date(
							now.getTime() + TENANT_DOCUMENT_RETENTION_SECONDS * 1000,
						),
						updatedAt: now,
					})
					.where(eq(tenantDocuments.id, request.sourceDocumentId));
				await tx
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.OWNER_REVIEWED,
						reviewedById: context.user.id,
						reviewedAt: now,
						updatedAt: now,
					})
					.where(eq(tenantDocuments.id, doc.id));
				await tx
					.update(documentUpdateRequests)
					.set({
						status: "completed",
						completedAt: now,
						reviewedById: context.user.id,
						reviewedAt: now,
						updatedAt: now,
					})
					.where(eq(documentUpdateRequests.id, request.id));
			}
			if (!request)
				await tx
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.OWNER_REVIEWED,
						reviewedById: context.user.id,
						reviewedAt: now,
						updatedAt: now,
					})
					.where(eq(tenantDocuments.id, doc.id));
			if (doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR)
				await tx
					.update(tenantProfiles)
					.set({ aadhaarLastFour: doc.identifierHint, updatedAt: now })
					.where(eq(tenantProfiles.id, row.profile.id));
		});
		return { success: true };
	});

export const getPrivateDocumentDownloadUrl = protectedProcedure
	.route({ method: "GET", path: "/rent/tenant-document/download" })
	.input(documentIdInput)
	.output(z.object({ downloadUrl: z.url() }))
	.handler(async ({ context, input }) => {
		const row = await findDocumentForActor(
			context.db,
			context.user,
			input.documentId,
		);
		if (row.document.purgedAt) fail("DOCUMENT_PURGED", "CONFLICT");
		const storage = documentStorage();
		if (!(await storage.headObject(row.document.storageKey)))
			fail("DOCUMENT_OBJECT_MISSING", "CONFLICT");
		return {
			downloadUrl: await storage.createDownloadUrl({
				key: row.document.storageKey,
				documentType: row.document.documentType,
				version: row.document.version,
				contentType: row.document.contentType,
				disposition: input.disposition,
			}),
		};
	});

export const createDocumentUpdateRequest = tenantProcedure
	.route({ method: "POST", path: "/rent/tenant-document/request-update" })
	.input(
		z.object({
			documentId: z.uuid(),
			reason: z.string().trim().min(1),
			consentAccepted: z.literal(true),
		}),
	)
	.output(z.object({ requestId: z.uuid() }))
	.handler(async ({ context, input }) => {
		const row = await findDocumentForActor(
			context.db,
			context.user,
			input.documentId,
		);
		if (row.document.status !== TENANT_DOCUMENT_STATUSES.OWNER_REVIEWED)
			fail("CONFLICT", "CONFLICT");
		const [active] = await context.db
			.select({ id: documentUpdateRequests.id })
			.from(documentUpdateRequests)
			.where(
				and(
					eq(documentUpdateRequests.sourceDocumentId, input.documentId),
					inArray(documentUpdateRequests.status, [
						"pending",
						"approved",
						"submitted",
					]),
				),
			)
			.limit(1);
		if (active) fail("DOCUMENT_UPDATE_ALREADY_ACTIVE", "CONFLICT");
		const requestId = generatedId();
		await context.db.insert(documentUpdateRequests).values({
			id: requestId,
			tenantProfileId: row.profile.id,
			ownerId: row.profile.ownerId as string,
			sourceDocumentId: input.documentId,
			requestedById: context.user.id,
			reason: input.reason,
			status: "pending",
			consentVersion: KEYHQ_DOCUMENT_CONSENT_VERSION,
			consentedAt: new Date(),
		});
		return { requestId };
	});

export const reviewDocumentUpdateRequest = ownerProcedure
	.route({
		method: "POST",
		path: "/rent/tenant-document/review-update-request",
	})
	.input(
		z.object({
			requestId: z.uuid(),
			decision: z.enum(["approve", "reject"]),
			note: z.string().trim().optional(),
		}),
	)
	.output(submitOutput)
	.handler(async ({ context, input }) => {
		const [request] = await context.db
			.select()
			.from(documentUpdateRequests)
			.where(
				and(
					eq(documentUpdateRequests.id, input.requestId),
					eq(documentUpdateRequests.ownerId, context.user.id),
				),
			)
			.limit(1);
		if (!request) fail("NOT_FOUND", "NOT_FOUND");
		if (request.status !== "pending") fail("CONFLICT", "CONFLICT");
		const now = new Date();
		if (input.decision === "reject") {
			await context.db
				.update(documentUpdateRequests)
				.set({
					status: "rejected",
					ownerNote: input.note ?? null,
					rejectedAt: now,
					reviewedById: context.user.id,
					reviewedAt: now,
					updatedAt: now,
				})
				.where(eq(documentUpdateRequests.id, request.id));
		} else {
			await context.db
				.update(documentUpdateRequests)
				.set({
					status: "approved",
					ownerNote: input.note ?? null,
					approvedExpiresAt: new Date(
						now.getTime() + TENANT_DOCUMENT_UPDATE_WINDOW_SECONDS * 1000,
					),
					reviewedById: context.user.id,
					reviewedAt: now,
					updatedAt: now,
				})
				.where(eq(documentUpdateRequests.id, request.id));
		}
		return { success: true };
	});

export const submitApprovedDocumentUpdate = protectedProcedure
	.route({ method: "POST", path: "/rent/tenant-document/submit-update" })
	.input(submitInput)
	.output(submitOutput)
	.handler(async ({ context, input }) => {
		const row = await findDocumentForActor(
			context.db,
			context.user,
			input.documentId,
		);
		const doc = row.document;
		if (
			!doc.updateRequestId ||
			doc.status !== TENANT_DOCUMENT_STATUSES.UPLOAD_PENDING
		)
			fail("CONFLICT", "CONFLICT");
		const [request] = await context.db
			.select()
			.from(documentUpdateRequests)
			.where(eq(documentUpdateRequests.id, doc.updateRequestId))
			.limit(1);
		const storage = documentStorage();
		if (!request) {
			await storage.deleteObject(doc.storageKey).catch(() => undefined);
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.EXPIRED,
					updatedAt: new Date(),
				})
				.where(eq(tenantDocuments.id, doc.id));
			fail("DOCUMENT_UPDATE_WINDOW_EXPIRED", "CONFLICT");
		}
		if (
			request.status !== "approved" ||
			!request.approvedExpiresAt ||
			new Date() >= request.approvedExpiresAt
		) {
			if (request?.status === "approved")
				await context.db
					.update(documentUpdateRequests)
					.set({
						status: "expired",
						expiredAt: new Date(),
						updatedAt: new Date(),
					})
					.where(eq(documentUpdateRequests.id, request.id));
			await storage.deleteObject(doc.storageKey).catch(() => undefined);
			await context.db
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.EXPIRED,
					updatedAt: new Date(),
				})
				.where(eq(tenantDocuments.id, doc.id));
			fail("DOCUMENT_UPDATE_WINDOW_EXPIRED", "CONFLICT");
		}
		validateAadhaarSubmission({
			documentType: doc.documentType,
			aadhaarLastFour: input.aadhaarLastFour,
			maskedAadhaarConfirmed: input.maskedAadhaarConfirmed,
		});
		let metadata: { etag: string; sizeBytes: number };
		try {
			metadata = await verifyUploadedObject(storage, doc);
		} catch (error) {
			if (
				error instanceof ORPCError &&
				error.message === "DOCUMENT_METADATA_MISMATCH"
			) {
				await context.db
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.EXPIRED,
						updatedAt: new Date(),
					})
					.where(eq(tenantDocuments.id, doc.id));
			}
			throw error;
		}
		const now = new Date();
		const submitReplacement = (database: Database) =>
			database
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.PENDING_REVIEW,
					etag: metadata.etag,
					identifierHint:
						doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR
							? input.aadhaarLastFour
							: null,
					maskedAadhaarConfirmed:
						doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR ? true : null,
					submittedAt: now,
					consentSource: DOCUMENT_CONSENT_SOURCES.TENANT_UPDATE_REQUEST,
					consentVersion: request.consentVersion,
					consentedById: request.requestedById,
					consentedAt: request.consentedAt,
					consentExpiresAt: request.approvedExpiresAt,
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, doc.id));
		const markRequestSubmitted = (database: Database) =>
			database
				.update(documentUpdateRequests)
				.set({ status: "submitted", submittedAt: now, updatedAt: now })
				.where(
					and(
						eq(documentUpdateRequests.id, request.id),
						eq(documentUpdateRequests.status, "approved"),
					),
				);
		if (supportsDatabaseBatch(context.db)) {
			await context.db.batch([
				submitReplacement(context.db),
				markRequestSubmitted(context.db),
			]);
		} else {
			await context.db.transaction(async (tx) => {
				await tx
					.update(tenantDocuments)
					.set({
						status: TENANT_DOCUMENT_STATUSES.PENDING_REVIEW,
						etag: metadata.etag,
						identifierHint:
							doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR
								? input.aadhaarLastFour
								: null,
						maskedAadhaarConfirmed:
							doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR ? true : null,
						submittedAt: now,
						consentSource: DOCUMENT_CONSENT_SOURCES.TENANT_UPDATE_REQUEST,
						consentVersion: request.consentVersion,
						consentedById: request.requestedById,
						consentedAt: request.consentedAt,
						consentExpiresAt: request.approvedExpiresAt,
						updatedAt: now,
					})
					.where(eq(tenantDocuments.id, doc.id));
				await tx
					.update(documentUpdateRequests)
					.set({ status: "submitted", submittedAt: now, updatedAt: now })
					.where(
						and(
							eq(documentUpdateRequests.id, request.id),
							eq(documentUpdateRequests.status, "approved"),
						),
					);
			});
		}
		return { success: true };
	});

export const tenantDocument = {
	listMyDocuments,
	listTenantDocuments,
	beginTenantDocumentUpload,
	submitInitialDocument,
	confirmOwnerSubmittedDocument,
	reviewTenantDocument,
	getPrivateDocumentDownloadUrl,
	createDocumentUpdateRequest,
	reviewDocumentUpdateRequest,
	submitApprovedDocumentUpdate,
};
