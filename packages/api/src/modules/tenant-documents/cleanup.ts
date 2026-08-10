import type { Database } from "@rently/db";
import {
	TENANT_DOCUMENT_CLEANUP_BATCH_SIZE,
	TENANT_DOCUMENT_CONSENT_SECONDS,
	TENANT_DOCUMENT_PURGE_ERROR_CODES,
	TENANT_DOCUMENT_RETENTION_SECONDS,
	TENANT_DOCUMENT_STATUSES,
	TENANT_DOCUMENT_UPLOAD_SESSION_SECONDS,
} from "@rently/db/constants/tenant-document-constants";
import {
	documentUpdateRequests,
	tenantDocuments,
} from "@rently/db/schema/schema";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { TenantDocumentStorage } from "./storage";

export type TenantDocumentCleanupResult = {
	uploadsExpired: number;
	consentsExpired: number;
	updateRequestsExpired: number;
	purged: number;
	purgeFailures: number;
};

function safePurgeErrorCode(error: unknown): string {
	if (
		error instanceof Error &&
		error.message === "PRIVATE_DOCUMENT_STORAGE_UNAVAILABLE"
	) {
		return TENANT_DOCUMENT_PURGE_ERROR_CODES.STORAGE_UNAVAILABLE;
	}
	if (
		error instanceof Error &&
		error.message === "PRIVATE_DOCUMENT_DELETE_FAILED"
	) {
		return TENANT_DOCUMENT_PURGE_ERROR_CODES.STORAGE_DELETE_FAILED;
	}
	return TENANT_DOCUMENT_PURGE_ERROR_CODES.UNKNOWN;
}

export async function runTenantDocumentCleanupJob(options: {
	database: Database;
	storage: TenantDocumentStorage;
	now?: Date;
}): Promise<TenantDocumentCleanupResult> {
	const { database, storage } = options;
	const now = options.now ?? new Date();
	const result: TenantDocumentCleanupResult = {
		uploadsExpired: 0,
		consentsExpired: 0,
		updateRequestsExpired: 0,
		purged: 0,
		purgeFailures: 0,
	};

	const expiredUploads = await database
		.select({ id: tenantDocuments.id, storageKey: tenantDocuments.storageKey })
		.from(tenantDocuments)
		.where(
			and(
				eq(tenantDocuments.status, TENANT_DOCUMENT_STATUSES.UPLOAD_PENDING),
				lte(tenantDocuments.uploadExpiresAt, now),
			),
		);
	for (const document of expiredUploads) {
		try {
			await storage.deleteObject(document.storageKey);
		} catch {
			// Upload sessions are already expired. Keep metadata and schedule a
			// normal retention purge if the best-effort cleanup could not delete it.
			await database
				.update(tenantDocuments)
				.set({
					status: TENANT_DOCUMENT_STATUSES.EXPIRED,
					purgeAfter: new Date(
						now.getTime() + TENANT_DOCUMENT_RETENTION_SECONDS * 1000,
					),
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, document.id));
			result.uploadsExpired += 1;
			continue;
		}
		await database
			.update(tenantDocuments)
			.set({ status: TENANT_DOCUMENT_STATUSES.EXPIRED, updatedAt: now })
			.where(eq(tenantDocuments.id, document.id));
		result.uploadsExpired += 1;
	}

	const expiredConsents = await database
		.select({ id: tenantDocuments.id, storageKey: tenantDocuments.storageKey })
		.from(tenantDocuments)
		.where(
			and(
				eq(
					tenantDocuments.status,
					TENANT_DOCUMENT_STATUSES.AWAITING_TENANT_CONSENT,
				),
				lte(tenantDocuments.consentExpiresAt, now),
			),
		);
	for (const document of expiredConsents) {
		await database
			.update(tenantDocuments)
			.set({
				status: TENANT_DOCUMENT_STATUSES.EXPIRED,
				purgeAfter: new Date(
					now.getTime() + TENANT_DOCUMENT_RETENTION_SECONDS * 1000,
				),
				updatedAt: now,
			})
			.where(eq(tenantDocuments.id, document.id));
		result.consentsExpired += 1;
	}

	const expiredRequests = await database
		.update(documentUpdateRequests)
		.set({ status: "expired", expiredAt: now, updatedAt: now })
		.where(
			and(
				eq(documentUpdateRequests.status, "approved"),
				lte(documentUpdateRequests.approvedExpiresAt, now),
			),
		)
		.returning();
	result.updateRequestsExpired = expiredRequests.length;

	const dueDocuments = await database
		.select({ id: tenantDocuments.id, storageKey: tenantDocuments.storageKey })
		.from(tenantDocuments)
		.where(
			and(
				lte(tenantDocuments.purgeAfter, now),
				isNull(tenantDocuments.purgedAt),
			),
		)
		.limit(TENANT_DOCUMENT_CLEANUP_BATCH_SIZE);

	for (const document of dueDocuments) {
		try {
			await storage.deleteObject(document.storageKey);
			await database
				.update(tenantDocuments)
				.set({ purgedAt: now, lastPurgeErrorCode: null, updatedAt: now })
				.where(
					and(
						eq(tenantDocuments.id, document.id),
						isNull(tenantDocuments.purgedAt),
					),
				);
			result.purged += 1;
		} catch (error) {
			await database
				.update(tenantDocuments)
				.set({
					purgeAttempts: sql`${tenantDocuments.purgeAttempts} + 1`,
					lastPurgeErrorCode: safePurgeErrorCode(error),
					updatedAt: now,
				})
				.where(eq(tenantDocuments.id, document.id));
			result.purgeFailures += 1;
		}
	}

	return result;
}

export const TENANT_DOCUMENT_CLEANUP_DEFAULTS = {
	uploadSessionSeconds: TENANT_DOCUMENT_UPLOAD_SESSION_SECONDS,
	consentSeconds: TENANT_DOCUMENT_CONSENT_SECONDS,
};
