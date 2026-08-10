import {
	type AllowedTenantDocumentContentType,
	TENANT_DOCUMENT_DOWNLOAD_URL_TTL_SECONDS,
	TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS,
	type TenantDocumentType,
} from "@rently/db/constants/tenant-document-constants";
import { env } from "@rently/env/server";
import { AwsClient } from "aws4fetch";

export type TenantDocumentUploadInput = {
	ownerId: string;
	tenantProfileId: string;
	documentId: string;
	documentType: TenantDocumentType;
	contentType: AllowedTenantDocumentContentType;
	version: number;
};

export type SignedUpload = {
	uploadUrl: string;
	storageKey: string;
	expiresAt: Date;
	requiredHeaders: {
		"Content-Type": AllowedTenantDocumentContentType;
		"Content-Disposition": string;
		"Cache-Control": "private, no-store";
	};
};

export type ObjectMetadata = {
	contentType: string | null;
	sizeBytes: number | null;
	etag: string | null;
};

export type TenantDocumentDownloadInput = {
	key: string;
	documentType: TenantDocumentType;
	version: number;
	contentType: string;
	disposition?: "inline" | "attachment";
};

export interface TenantDocumentStorage {
	createUploadUrl(input: TenantDocumentUploadInput): Promise<SignedUpload>;
	headObject(key: string): Promise<ObjectMetadata | null>;
	createDownloadUrl(input: TenantDocumentDownloadInput): Promise<string>;
	deleteObject(key: string): Promise<void>;
}

export function tenantDocumentStorageKey(input: {
	ownerId: string;
	tenantProfileId: string;
	documentId: string;
}): string {
	return `tenant-documents/${input.ownerId}/${input.tenantProfileId}/${input.documentId}`;
}

function safeFilename(
	documentType: TenantDocumentType,
	version: number,
): string {
	return `${documentType}-v${version}`;
}

function objectUrl(key: string): string {
	const endpoint = env.R2_S3_ENDPOINT.replace(/\/$/, "");
	return `${endpoint}/${env.R2_PRIVATE_BUCKET_NAME}/${key}`;
}

function requirePrivateCredentials(): {
	accessKeyId: string;
	secretAccessKey: string;
} {
	if (!env.R2_PRIVATE_ACCESS_KEY_ID || !env.R2_PRIVATE_SECRET_ACCESS_KEY) {
		throw new Error("PRIVATE_DOCUMENT_STORAGE_NOT_CONFIGURED");
	}
	return {
		accessKeyId: env.R2_PRIVATE_ACCESS_KEY_ID,
		secretAccessKey: env.R2_PRIVATE_SECRET_ACCESS_KEY,
	};
}

export class R2TenantDocumentStorage implements TenantDocumentStorage {
	private readonly client: AwsClient;

	constructor() {
		const credentials = requirePrivateCredentials();
		this.client = new AwsClient({
			accessKeyId: credentials.accessKeyId,
			secretAccessKey: credentials.secretAccessKey,
			region: "auto",
			service: "s3",
		});
	}

	async createUploadUrl(
		input: TenantDocumentUploadInput,
	): Promise<SignedUpload> {
		const storageKey = tenantDocumentStorageKey(input);
		const expiresAt = new Date(
			Date.now() + TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS * 1000,
		);
		const requiredHeaders = {
			"Content-Type": input.contentType,
			"Content-Disposition": `attachment; filename="${safeFilename(input.documentType, input.version)}"`,
			"Cache-Control": "private, no-store" as const,
		};
		const uploadUrl = new URL(objectUrl(storageKey));
		uploadUrl.searchParams.set(
			"X-Amz-Expires",
			String(TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS),
		);
		const signed = await this.client.sign(
			new Request(uploadUrl.toString(), {
				method: "PUT",
				headers: requiredHeaders,
			}),
			{
				aws: {
					signQuery: true,
				},
			},
		);
		return { uploadUrl: signed.url, storageKey, expiresAt, requiredHeaders };
	}

	async headObject(key: string): Promise<ObjectMetadata | null> {
		const signed = await this.client.sign(
			new Request(objectUrl(key), { method: "HEAD" }),
		);
		const response = await fetch(signed);
		if (response.status === 404 || response.status === 403) return null;
		if (!response.ok) throw new Error("PRIVATE_DOCUMENT_STORAGE_UNAVAILABLE");
		const sizeHeader = response.headers.get("content-length");
		return {
			contentType: response.headers.get("content-type"),
			sizeBytes: sizeHeader ? Number(sizeHeader) : null,
			etag: response.headers.get("etag"),
		};
	}

	async createDownloadUrl(input: TenantDocumentDownloadInput): Promise<string> {
		const url = new URL(objectUrl(input.key));
		url.searchParams.set("response-cache-control", "private, no-store");
		url.searchParams.set(
			"response-content-disposition",
			`${input.disposition ?? "attachment"}; filename="${safeFilename(input.documentType, input.version)}"`,
		);
		url.searchParams.set("response-content-type", input.contentType);
		url.searchParams.set(
			"X-Amz-Expires",
			String(TENANT_DOCUMENT_DOWNLOAD_URL_TTL_SECONDS),
		);
		const signed = await this.client.sign(
			new Request(url.toString(), { method: "GET" }),
			{
				aws: {
					signQuery: true,
				},
			},
		);
		return signed.url;
	}

	async deleteObject(key: string): Promise<void> {
		const signed = await this.client.sign(
			new Request(objectUrl(key), { method: "DELETE" }),
		);
		const response = await fetch(signed);
		if (!response.ok && response.status !== 404) {
			throw new Error("PRIVATE_DOCUMENT_DELETE_FAILED");
		}
	}
}

type StoredObject = ObjectMetadata & { body: Uint8Array };

export class InMemoryTenantDocumentStorage implements TenantDocumentStorage {
	private readonly objects = new Map<string, StoredObject>();

	async createUploadUrl(
		input: TenantDocumentUploadInput,
	): Promise<SignedUpload> {
		const storageKey = tenantDocumentStorageKey(input);
		const expiresAt = new Date(
			Date.now() + TENANT_DOCUMENT_UPLOAD_URL_TTL_SECONDS * 1000,
		);
		return {
			uploadUrl: `https://in-memory.invalid/upload/${encodeURIComponent(storageKey)}`,
			storageKey,
			expiresAt,
			requiredHeaders: {
				"Content-Type": input.contentType,
				"Content-Disposition": `attachment; filename="${safeFilename(input.documentType, input.version)}"`,
				"Cache-Control": "private, no-store",
			},
		};
	}

	async headObject(key: string): Promise<ObjectMetadata | null> {
		const object = this.objects.get(key);
		return object
			? {
					contentType: object.contentType,
					sizeBytes: object.sizeBytes,
					etag: object.etag,
				}
			: null;
	}

	async createDownloadUrl(input: TenantDocumentDownloadInput): Promise<string> {
		if (!this.objects.has(input.key))
			throw new Error("DOCUMENT_OBJECT_MISSING");
		return `https://in-memory.invalid/download/${encodeURIComponent(input.key)}?ttl=${TENANT_DOCUMENT_DOWNLOAD_URL_TTL_SECONDS}&disposition=${input.disposition ?? "attachment"}`;
	}

	async deleteObject(key: string): Promise<void> {
		this.objects.delete(key);
	}

	putObject(input: {
		key: string;
		contentType: string;
		body?: Uint8Array;
		etag?: string;
	}): void {
		const body = input.body ?? new Uint8Array(1);
		this.objects.set(input.key, {
			body,
			contentType: input.contentType,
			sizeBytes: body.byteLength,
			etag: input.etag ?? `"fake-${body.byteLength}"`,
		});
	}

	hasObject(key: string): boolean {
		return this.objects.has(key);
	}
}

export function createR2TenantDocumentStorage(): TenantDocumentStorage {
	return new R2TenantDocumentStorage();
}
