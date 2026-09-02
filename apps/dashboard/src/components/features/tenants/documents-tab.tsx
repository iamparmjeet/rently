"use client";

import {
	TENANT_DOCUMENT_TYPES,
	type TenantDocumentType,
} from "@rently/db/constants/tenant-document-constants";
import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
import { PrivateDocumentViewer } from "@rently/ui/components/private-document-viewer";
import { usePrivateDocumentUrlCache } from "@rently/ui/hooks/use-private-document-url-cache";
import type { TenantDetail } from "@rently/validators";
import { IconDownload, IconEye, IconFileText } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTenantDocumentAction, useTenantDocuments } from "@/hooks/tenants";
import { client, orpc } from "@/utils/orpc";

const DOCUMENTS: Array<{ type: TenantDocumentType; label: string }> = [
	{ type: TENANT_DOCUMENT_TYPES.AADHAAR, label: "Aadhaar" },
	{ type: TENANT_DOCUMENT_TYPES.PAN, label: "PAN" },
	{ type: TENANT_DOCUMENT_TYPES.PASSPORT_PHOTO, label: "Passport photo" },
	{
		type: TENANT_DOCUMENT_TYPES.POLICE_VERIFICATION,
		label: "Police verification",
	},
	{ type: TENANT_DOCUMENT_TYPES.BANK_PASSBOOK, label: "Bank passbook" },
	{ type: TENANT_DOCUMENT_TYPES.VOTER_ID, label: "Voter ID" },
];
const ACCEPT = "application/pdf,image/jpeg,image/png";

function putWithProgress(
	url: string,
	file: File,
	headers: Record<string, string>,
	onProgress?: (pct: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url, true);
		for (const [k, v] of Object.entries(headers)) {
			xhr.setRequestHeader(k, v);
		}
		xhr.upload.onprogress = (e) => {
			if (e.lengthComputable && onProgress)
				onProgress(Math.round((e.loaded / e.total) * 100));
		};
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(`Upload failed (${xhr.status})`));
		xhr.onerror = () => reject(new Error("Upload failed"));
		xhr.send(file);
	});
}

function statusLabel(doc: DocumentSummary): string {
	if (doc.updateRequest?.status === "pending") return "Replacement requested";
	if (doc.updateRequest?.status === "approved") return "Replacement approved";
	if (doc.updateRequest?.status === "submitted") return "Replacement submitted";
	if (doc.updateRequest?.status === "rejected") return "Replacement rejected";
	if (doc.purgedAt) return "Historical file purged";
	return (
		{
			upload_pending: "Uploading",
			awaiting_tenant_consent: "Awaiting tenant consent",
			pending_review: "Pending owner review",
			owner_reviewed: "Owner reviewed",
			rejected: "Rejected",
			superseded: "Historical file",
			expired: "Expired",
		}[doc.status] ?? doc.status
	);
}

type DocumentSummary = Awaited<
	ReturnType<typeof client.rent.tenantDocument.listTenantDocuments>
>["documents"][number];

export function DocumentsTab({ tenant }: { tenant: TenantDetail }) {
	const { data, isLoading } = useTenantDocuments(tenant.id);
	const actions = useTenantDocumentAction(tenant.id);
	const queryClient = useQueryClient();
	const [upload, setUpload] = useState<{
		type: TenantDocumentType;
		requestId?: string;
		file?: File;
	}>({ type: TENANT_DOCUMENT_TYPES.PAN });
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [optimistic, setOptimistic] = useState<DocumentSummary | null>(null);
	const isUploading =
		actions.begin.isPending ||
		actions.submitInitial.isPending ||
		actions.submitUpdate.isPending;
	const fileRef = useRef<HTMLInputElement>(null);
	const documentUrlCache = usePrivateDocumentUrlCache();
	const [viewer, setViewer] = useState<{
		documentId: string;
		title: string;
		contentType: string;
		url: string | null;
		error: string | null;
	} | null>(null);
	if (isLoading)
		return <div className="h-64 animate-pulse rounded-xl bg-muted" />;

	const docs = data?.documents ?? [];
	const enabled = (type: TenantDocumentType) =>
		data?.capabilities.documentTypes.find((item) => item.type === type)
			?.enabled ?? false;

	async function download(documentId: string) {
		try {
			const result =
				await client.rent.tenantDocument.getPrivateDocumentDownloadUrl({
					documentId,
					disposition: "attachment",
				});
			window.location.assign(result.downloadUrl);
		} catch (error) {
			toast.error(
				error instanceof Error ? error.message : "Could not open document",
			);
		}
	}

	async function view(document: DocumentSummary, title: string) {
		setViewer({
			documentId: document.id,
			title,
			contentType: document.contentType,
			url: null,
			error: null,
		});

		try {
			const previewUrl = await documentUrlCache.getPreviewUrl(
				document.id,
				async () => {
					const result =
						await client.rent.tenantDocument.getPrivateDocumentDownloadUrl({
							documentId: document.id,
							disposition: "inline",
						});

					return result.downloadUrl;
				},
			);

			setViewer((current) =>
				current ? { ...current, url: previewUrl } : current,
			);
		} catch (error) {
			setViewer((current) =>
				current
					? {
							...current,
							error:
								error instanceof Error
									? error.message
									: "Could not open document",
						}
					: current,
			);
		}
	}

	async function submitUpload() {
		if (!upload.file || !data) return;
		if (upload.file.size > data.capabilities.maxBytes)
			return toast.error("Files must be 10 MB or smaller.");
		const contentType = upload.file.type as
			| "application/pdf"
			| "image/jpeg"
			| "image/png";
		if (!data.capabilities.allowedContentTypes.includes(contentType))
			return toast.error("Only PDF, JPEG, and PNG files are allowed.");
		const aadhaarLastFour =
			upload.type === TENANT_DOCUMENT_TYPES.AADHAAR
				? (
						document.querySelector(
							"#owner-aadhaar-last-four",
						) as HTMLInputElement
					)?.value
				: undefined;
		const maskedAadhaarConfirmed =
			upload.type === TENANT_DOCUMENT_TYPES.AADHAAR &&
			(document.querySelector("#owner-aadhaar-masked") as HTMLInputElement)
				?.checked
				? true
				: undefined;
		// C+A: optimistic blur in <200ms before network
		const optimisticDoc = {
			id: `optimistic-${upload.type}-${Date.now()}`,
			documentType: upload.type,
			version: 1,
			status: "upload_pending",
			contentType: contentType as string,
			sizeBytes: upload.file.size,
			identifierHint: null,
			submissionSource: "owner",
			submittedAt: new Date().toISOString() as unknown as Date,
			consentExpiresAt: null,
			reviewedAt: null,
			reviewNote: null,
			purgeAfter: null,
			purgedAt: null,
			updateRequest: null,
		} as unknown as DocumentSummary;
		setOptimistic(optimisticDoc);
		queryClient.setQueryData(
			orpc.rent.tenantDocument.listTenantDocuments.key({
				input: { tenantId: tenant.id },
			}),
			(old: unknown) => {
				const prev = old as
					| { documents: DocumentSummary[]; capabilities: unknown }
					| undefined;
				if (!prev) return prev;
				return { ...prev, documents: [optimisticDoc, ...prev.documents] };
			},
		);
		setUploadProgress(0);
		try {
			const signed = await actions.begin.mutateAsync({
				tenantId: tenant.id,
				documentType: upload.type,
				contentType,
				sizeBytes: upload.file.size,
				target: upload.requestId
					? { kind: "replacement", requestId: upload.requestId }
					: { kind: "initial" },
			});
			// C+A hybrid: XHR progress for >2MB, fetch spinner otherwise
			if (upload.file.size > 2 * 1024 * 1024) {
				await putWithProgress(
					signed.uploadUrl,
					upload.file,
					signed.requiredHeaders as Record<string, string>,
					(pct) => setUploadProgress(pct),
				);
			} else {
				const response = await fetch(signed.uploadUrl, {
					method: "PUT",
					body: upload.file,
					headers: signed.requiredHeaders,
				});
				if (!response.ok) throw new Error(`Upload failed (${response.status})`);
			}
			if (upload.requestId)
				await actions.submitUpdate.mutateAsync({
					documentId: signed.documentId,
					aadhaarLastFour,
					maskedAadhaarConfirmed,
				});
			else
				await actions.submitInitial.mutateAsync({
					documentId: signed.documentId,
					aadhaarLastFour,
					maskedAadhaarConfirmed,
				});
			toast.success("Document uploaded and awaiting tenant consent.");
			setUpload({ type: TENANT_DOCUMENT_TYPES.PAN });
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Document upload failed. Retry while the upload session is valid.",
			);
			queryClient.setQueryData(
				orpc.rent.tenantDocument.listTenantDocuments.key({
					input: { tenantId: tenant.id },
				}),
				(old: unknown) => {
					const prev = old as
						| { documents: DocumentSummary[]; capabilities: unknown }
						| undefined;
					if (!prev) return prev;
					return {
						...prev,
						documents: prev.documents.filter(
							(d) => !d.id.startsWith("optimistic-"),
						),
					};
				},
			);
		} finally {
			setUploadProgress(null);
			setOptimistic(null);
		}
	}

	return (
		<div>
			<div className="mb-6">
				<h3 className="font-semibold text-base">Private documents</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Review each document independently. The tenant must confirm
					owner-submitted files before review.
				</p>
			</div>
			{tenant.status !== "accepted" && (
				<div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
					<p className="font-semibold text-amber-800 text-sm">
						Tenant invite is {tenant.status} — you can still upload documents
						and create a lease
					</p>
					<p className="mt-1 text-amber-700 text-xs">
						Invite not yet accepted. Owner can upload documents, create lease
						and send email/WhatsApp now. Tenant will confirm documents after
						accepting — remind them to check email for the invite link.
					</p>
				</div>
			)}
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{DOCUMENTS.map(({ type, label }) => {
					const doc =
						docs.find(
							(item) =>
								item.documentType === type && item.status !== "superseded",
						) ?? null;
					const request = doc?.updateRequest;
					const isOptimistic = optimistic?.documentType === type;
					return (
						<div
							key={type}
							className={`relative overflow-hidden rounded-xl border bg-card p-5 ${isOptimistic ? "opacity-60 blur-[0.5px]" : ""}`}
						>
							{isOptimistic && uploadProgress !== null && (
								<div className="absolute inset-x-0 top-0 h-1 bg-muted">
									<div
										className="h-full bg-primary transition-all"
										style={{ width: `${uploadProgress}%` }}
									/>
								</div>
							)}
							{isOptimistic && (
								<div className="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 font-semibold text-[10px] text-primary-foreground">
									<div className="h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
									{uploadProgress !== null && uploadProgress > 0
										? `${uploadProgress}%`
										: "Uploading…"}
								</div>
							)}
							<div className="flex items-start gap-3">
								<div className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
									<IconFileText className="size-5" />
								</div>
								<div>
									<p className="font-medium text-sm">{label}</p>
									<p className="mt-0.5 text-muted-foreground text-xs">
										{doc ? statusLabel(doc) : "Not submitted"}
									</p>
									{doc?.identifierHint && (
										<p className="mt-1 font-mono text-muted-foreground text-xs">
											{type === TENANT_DOCUMENT_TYPES.AADHAAR
												? `XXXX XXXX ${doc.identifierHint}`
												: doc.identifierHint}
										</p>
									)}
								</div>
							</div>
							{doc?.reviewNote && (
								<p className="mt-3 rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
									Note: {doc.reviewNote}
								</p>
							)}
							{request?.reason && (
								<p className="mt-3 text-muted-foreground text-xs">
									Replacement reason: {request.reason}
								</p>
							)}
							<div className="mt-4 flex flex-wrap gap-2">
								{doc && !doc.purgedAt && (
									<>
										<Button
											size="sm"
											variant="outline"
											onClick={() =>
												view(
													doc,
													DOCUMENTS.find((item) => item.type === type)?.label ??
														type,
												)
											}
										>
											<IconEye />
											View
										</Button>
										<Button
											size="sm"
											variant="outline"
											onClick={() => download(doc.id)}
										>
											<IconDownload />
											Download
										</Button>
									</>
								)}
								{doc &&
									[
										"upload_pending",
										"pending_review",
										"awaiting_tenant_consent",
									].includes(doc.status) &&
									!doc.purgedAt && (
										<Button
											size="sm"
											variant="ghost"
											disabled={actions.deletePending.isPending}
											onClick={() => {
												if (
													window.confirm(
														`Delete ${label}? This keeps audit via deletedAt.`,
													)
												) {
													actions.deletePending.mutate({ documentId: doc.id });
												}
											}}
										>
											Delete
										</Button>
									)}
								{doc?.status === "pending_review" && (
									<>
										<Button
											size="sm"
											onClick={() => {
												const maskedAadhaarConfirmed =
													doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR
														? window.confirm(
																"I confirm this Aadhaar copy is masked.",
															)
															? true
															: undefined
														: undefined;
												if (
													doc.documentType === TENANT_DOCUMENT_TYPES.AADHAAR &&
													!maskedAadhaarConfirmed
												)
													return;
												actions.review.mutate({
													documentId: doc.id,
													decision: "approve",
													maskedAadhaarConfirmed,
												});
											}}
										>
											Approve
										</Button>
										<Button
											size="sm"
											variant="destructive"
											onClick={() => {
												const note = window.prompt(
													"Tenant-visible rejection note",
												);
												if (note?.trim())
													actions.review.mutate({
														documentId: doc.id,
														decision: "reject",
														note: note.trim(),
													});
											}}
										>
											Reject
										</Button>
									</>
								)}
								{request?.status === "pending" && (
									<>
										<Button
											size="sm"
											onClick={() =>
												actions.reviewUpdate.mutate({
													requestId: request.id,
													decision: "approve",
												})
											}
										>
											Approve replacement
										</Button>
										<Button
											size="sm"
											variant="destructive"
											onClick={() =>
												actions.reviewUpdate.mutate({
													requestId: request.id,
													decision: "reject",
													note: window.prompt("Optional note") ?? undefined,
												})
											}
										>
											Reject replacement
										</Button>
									</>
								)}
								{request?.status === "approved" && (
									<Button
										size="sm"
										variant="outline"
										onClick={() => {
											setUpload({ type, requestId: request.id });
											fileRef.current?.click();
										}}
									>
										Upload replacement
									</Button>
								)}
							</div>
							{(!doc ||
								doc.purgedAt ||
								doc.status === "expired" ||
								doc.status === "rejected") &&
								enabled(type) &&
								!isOptimistic && (
									<Button
										className="mt-4 w-full"
										size="sm"
										onClick={() => {
											setUpload({ type });
											fileRef.current?.click();
										}}
									>
										{doc?.purgedAt ? "Upload again" : "Upload on behalf"}
									</Button>
								)}
							{!enabled(type) && type === TENANT_DOCUMENT_TYPES.AADHAAR && (
								<p className="mt-3 text-amber-600 text-xs">
									Aadhaar uploads are disabled until compliance review is
									complete.
								</p>
							)}
						</div>
					);
				})}
			</div>
			<input
				ref={fileRef}
				className="hidden"
				type="file"
				accept={ACCEPT}
				onChange={(event) => {
					const file = event.target.files?.[0];
					if (file) setUpload((current) => ({ ...current, file }));
					event.currentTarget.value = "";
				}}
			/>
			{upload.file && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
					<div className="w-full max-w-md space-y-4 rounded-xl bg-background p-5 shadow-xl">
						<h2 className="font-bold">
							Upload{" "}
							{DOCUMENTS.find((item) => item.type === upload.type)?.label}
						</h2>
						<p className="text-muted-foreground text-sm">
							{upload.file.name} · {(upload.file.size / 1024 / 1024).toFixed(2)}{" "}
							MB
						</p>
						{upload.type === TENANT_DOCUMENT_TYPES.AADHAAR && (
							<>
								<div>
									<Label htmlFor="owner-aadhaar-last-four">
										Last four digits
									</Label>
									<Input
										id="owner-aadhaar-last-four"
										inputMode="numeric"
										maxLength={4}
									/>
								</div>
								<label className="flex items-start gap-2 text-sm">
									<input
										id="owner-aadhaar-masked"
										type="checkbox"
										className="mt-1"
									/>{" "}
									This Aadhaar copy is masked.
								</label>
							</>
						)}
						{uploadProgress !== null && upload.file.size > 2 * 1024 * 1024 && (
							<div className="space-y-1">
								<div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
									<div
										className="h-full bg-primary transition-all"
										style={{ width: `${uploadProgress}%` }}
									/>
								</div>
								<p className="text-muted-foreground text-xs">
									{uploadProgress}% uploaded
								</p>
							</div>
						)}
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								disabled={isUploading}
								onClick={() => {
									setUpload({ type: upload.type });
									setUploadProgress(null);
									setOptimistic(null);
								}}
							>
								Cancel
							</Button>
							<Button onClick={submitUpload} disabled={isUploading}>
								{isUploading
									? uploadProgress !== null && uploadProgress > 0
										? `${uploadProgress}%`
										: "Uploading…"
									: "Upload"}
							</Button>
						</div>
					</div>
				</div>
			)}
			{viewer && (
				<PrivateDocumentViewer
					open
					onOpenChange={(open) => !open && setViewer(null)}
					title={viewer.title}
					contentType={viewer.contentType}
					url={viewer.url}
					error={viewer.error}
					loading={!viewer.url && !viewer.error}
					onDownload={() => download(viewer.documentId)}
				/>
			)}
		</div>
	);
}
