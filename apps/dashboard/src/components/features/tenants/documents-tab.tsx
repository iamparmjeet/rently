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
import { useRef, useState } from "react";
import { toast } from "sonner";
import { useTenantDocumentAction, useTenantDocuments } from "@/hooks/tenants";
import { client } from "@/utils/orpc";

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
	const [upload, setUpload] = useState<{
		type: TenantDocumentType;
		requestId?: string;
		file?: File;
	}>({ type: TENANT_DOCUMENT_TYPES.PAN });
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
			const response = await fetch(signed.uploadUrl, {
				method: "PUT",
				body: upload.file,
				headers: signed.requiredHeaders,
			});
			if (!response.ok) throw new Error(`Upload failed (${response.status})`);
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
		}
	}

	// Pending invite (no profile yet) — documents not available until tenant accepts
	if (tenant.status !== "accepted") {
		return (
			<div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-center">
				<p className="font-semibold text-amber-800 text-sm">
					Tenant has not accepted invite yet
				</p>
				<p className="mt-1 text-amber-700 text-xs">
					Invite is {tenant.status}. Documents will be available after the
					tenant accepts the invite and creates their account. You can resend
					the invite from the tenant list.
				</p>
			</div>
		);
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
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{DOCUMENTS.map(({ type, label }) => {
					const doc =
						docs.find(
							(item) =>
								item.documentType === type && item.status !== "superseded",
						) ?? null;
					const request = doc?.updateRequest;
					return (
						<div key={type} className="rounded-xl border bg-card p-5">
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
							{!doc && enabled(type) && (
								<Button
									className="mt-4 w-full"
									size="sm"
									onClick={() => {
										setUpload({ type });
										fileRef.current?.click();
									}}
								>
									Upload on behalf
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
						<div className="flex justify-end gap-2">
							<Button
								variant="outline"
								onClick={() => setUpload({ type: upload.type })}
							>
								Cancel
							</Button>
							<Button
								onClick={submitUpload}
								disabled={
									actions.begin.isPending ||
									actions.submitInitial.isPending ||
									actions.submitUpdate.isPending
								}
							>
								Upload
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
