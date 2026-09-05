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
import { cn } from "@rently/ui/lib/utils";
import {
	IconClock,
	IconDownload,
	IconEye,
	IconFileText,
	IconUser,
} from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	useTenantAgreements,
	useTenantDocumentAction,
	useTenantDocuments,
	useTenantProfile,
} from "@/hooks/tenant-portal";
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

type DocumentSummary = Awaited<
	ReturnType<typeof client.rent.tenantDocument.listMyDocuments>
>["documents"][number];

function statusLabel(doc: DocumentSummary): string {
	const request = doc.updateRequest;
	if (request?.status === "pending") return "Replacement requested";
	if (request?.status === "approved") return "Replacement approved";
	if (request?.status === "submitted") return "Replacement submitted";
	if (request?.status === "rejected") return "Replacement rejected";
	if (doc.purgedAt) return "Historical file purged";
	return (
		{
			upload_pending: "Uploading",
			awaiting_tenant_consent: "Awaiting your consent",
			pending_review: "Pending owner review",
			owner_reviewed: "Owner reviewed",
			rejected: "Rejected",
			superseded: "Historical file",
			expired: "Expired",
		}[doc.status as string] ?? doc.status
	);
}

function Countdown({ until }: { until: string | Date }) {
	const [now, setNow] = useState(() => Date.now());
	const remaining = Math.max(0, new Date(until).getTime() - now);
	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);
	if (!remaining) return <span>Window expired</span>;
	const hours = Math.floor(remaining / 3_600_000);
	const minutes = Math.floor((remaining % 3_600_000) / 60_000);
	return (
		<span>
			{hours}h {minutes}m remaining
		</span>
	);
}

export function DocsTab() {
	const { data: profileData, isLoading: profileLoading } = useTenantProfile();
	const { data: agreementsData, isLoading: agreementsLoading } =
		useTenantAgreements();
	const { data, isLoading } = useTenantDocuments();
	const actions = useTenantDocumentAction();
	const queryClient = useQueryClient();
	const [upload, setUpload] = useState<{
		type: TenantDocumentType;
		requestId?: string;
		file?: File;
	}>({ type: TENANT_DOCUMENT_TYPES.PAN });
	const [consentChecked, setConsentChecked] = useState(false);
	const [aadhaarLastFour, setAadhaarLastFour] = useState("");
	const [maskedConfirmed, setMaskedConfirmed] = useState(false);
	const [uploadProgress, setUploadProgress] = useState<number | null>(null);
	const [optimistic, setOptimistic] = useState<DocumentSummary | null>(null);
	const fileRef = useRef<HTMLInputElement>(null);
	const documentUrlCache = usePrivateDocumentUrlCache();
	const [viewer, setViewer] = useState<{
		documentId: string;
		title: string;
		contentType: string;
		url: string | null;
		error: string | null;
	} | null>(null);
	const profile = profileData?.profile;
	const activeUnits = (agreementsData?.agreements ?? []).flatMap((agreement) =>
		agreement.units
			.filter((unit) => unit.status === "active")
			.map((unit) => `Unit ${unit.unitNumber}, ${agreement.property.name}`),
	);

	if (profileLoading || agreementsLoading || isLoading)
		return <div className="h-80 animate-pulse rounded-xl bg-muted" />;

	const docs = data?.documents ?? [];
	const caps = data?.capabilities;
	const enabled = (type: TenantDocumentType) =>
		caps?.documentTypes.find((item) => item.type === type)?.enabled ?? false;

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
		if (!consentChecked) {
			toast.error("Please confirm document consent before submitting.");
			return;
		}
		if (upload.file.size > data.capabilities.maxBytes) {
			toast.error("Files must be 10 MB or smaller.");
			return;
		}
		const contentType = upload.file.type as
			| "application/pdf"
			| "image/jpeg"
			| "image/png";
		if (!data.capabilities.allowedContentTypes.includes(contentType)) {
			toast.error("Only PDF, JPEG, and PNG files are allowed.");
			return;
		}
		if (
			upload.type === TENANT_DOCUMENT_TYPES.AADHAAR &&
			aadhaarLastFour &&
			!/^\d{4}$/.test(aadhaarLastFour)
		) {
			toast.error("Last four digits must be 4 numbers");
			return;
		}
		// C+A hybrid: optimistic blur card in <200ms, progress for >2MB via XHR
		const optimisticDoc: DocumentSummary = {
			id: `optimistic-${upload.type}-${Date.now()}`,
			documentType: upload.type,
			version: 1,
			status: "upload_pending" as const,
			contentType: contentType as string,
			sizeBytes: upload.file.size,
			identifierHint: null,
			submissionSource: "tenant" as const,
			submittedAt: new Date().toISOString() as unknown as Date,
			consentExpiresAt: null,
			reviewedAt: null,
			reviewNote: null,
			purgeAfter: null,
			purgedAt: null,
			updateRequest: null,
		} as unknown as DocumentSummary;
		setOptimistic(optimisticDoc);
		// also patch query cache so owner view sees it instantly after invalidate
		queryClient.setQueryData(
			orpc.rent.tenantDocument.listMyDocuments.key(),
			(old: unknown) => {
				const prev = old as
					| {
							documents: DocumentSummary[];
							capabilities: typeof data.capabilities;
					  }
					| undefined;
				if (!prev) return prev;
				return { ...prev, documents: [optimisticDoc, ...prev.documents] };
			},
		);
		setUploadProgress(0);
		try {
			await actions.mutateAsync({
				file: upload.file,
				tenantId: undefined,
				documentType: upload.type,
				contentType,
				sizeBytes: upload.file.size,
				target: upload.requestId
					? { kind: "replacement", requestId: upload.requestId }
					: { kind: "initial" },
				onProgress: (pct: number) => setUploadProgress(pct),
				aadhaarLastFour:
					upload.type === TENANT_DOCUMENT_TYPES.AADHAAR
						? aadhaarLastFour || undefined
						: undefined,
				maskedAadhaarConfirmed:
					upload.type === TENANT_DOCUMENT_TYPES.AADHAAR && maskedConfirmed
						? true
						: undefined,
			} as never);
			toast.success("Document submitted for owner review.");
			setUpload({ type: TENANT_DOCUMENT_TYPES.PAN });
			setConsentChecked(false);
			setAadhaarLastFour("");
			setMaskedConfirmed(false);
		} catch (error) {
			toast.error(
				error instanceof Error
					? error.message
					: "Document upload failed. You can retry.",
			);
			// remove optimistic on error
			queryClient.setQueryData(
				orpc.rent.tenantDocument.listMyDocuments.key(),
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
		<div className="space-y-3.5">
			<div>
				<h1 className="font-extrabold text-xl">My Profile & Documents</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Private documents are shared only with your owner for review.
				</p>
			</div>
			<div className="rounded-xl border bg-background">
				<div className="flex items-center gap-3 border-b px-4 py-3">
					<div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
						<IconUser className="h-5 w-5 text-primary" />
					</div>
					<div>
						<p className="font-bold">{profile?.name ?? "—"}</p>
						<p className="text-muted-foreground text-xs">
							{profile?.email ?? "—"}
						</p>
					</div>
					<div className="ml-auto flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-semibold text-muted-foreground text-xs">
						<IconClock className="h-3 w-3" /> Per-document review
					</div>
				</div>
				<div className="divide-y divide-border">
					<ProfileRow label="Phone" value={profile?.phone ?? "Not provided"} />
					<ProfileRow
						label="Address"
						value={profile?.address ?? "Not provided"}
					/>
					{activeUnits.length > 0 && (
						<ProfileRow
							label={
								activeUnits.length === 1 ? "Current unit" : "Current units"
							}
							value={activeUnits.join(" · ")}
						/>
					)}
				</div>
			</div>
			<div>
				<p className="mb-2.5 font-bold text-sm">Documents</p>
				<div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
					{DOCUMENTS.map(({ type, label }) => {
						const document =
							docs.find(
								(item) =>
									item.documentType === type && item.status !== "superseded",
							) ?? null;
						const request = document?.updateRequest;
						const canRequest =
							document?.status === "owner_reviewed" && !request;
						const canUploadReplacement = request?.status === "approved";
						const isOptimistic = optimistic?.documentType === type;
						return (
							<div
								key={type}
								className={cn(
									"relative overflow-hidden rounded-xl border bg-background p-4",
									isOptimistic && "opacity-60 blur-[0.5px]",
								)}
							>
								{isOptimistic &&
									uploadProgress !== null &&
									uploadProgress > 0 && (
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
									<div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
										<IconFileText className="h-5 w-5" />
									</div>
									<div className="min-w-0">
										<p className="font-semibold text-sm">{label}</p>
										<p
											className={cn(
												"text-xs",
												document?.status === "owner_reviewed"
													? "text-emerald-600"
													: "text-muted-foreground",
											)}
										>
											{document ? statusLabel(document) : "Not submitted"}
										</p>
										{document?.identifierHint && (
											<p className="mt-1 font-mono text-muted-foreground text-xs">
												{type === TENANT_DOCUMENT_TYPES.AADHAAR
													? `XXXX XXXX ${document.identifierHint}`
													: document.identifierHint}
											</p>
										)}
									</div>
								</div>
								{request?.reason && (
									<p className="mt-3 rounded-md bg-muted px-3 py-2 text-muted-foreground text-xs">
										Reason: {request.reason}
									</p>
								)}
								{request?.status === "approved" &&
									request.approvedExpiresAt && (
										<p className="mt-2 text-amber-600 text-xs">
											<Countdown until={request.approvedExpiresAt} />
										</p>
									)}
								{request?.status === "rejected" && request.ownerNote && (
									<p className="mt-2 text-destructive text-xs">
										{request.ownerNote}
									</p>
								)}
								<div className="mt-3 flex flex-wrap gap-2">
									{document && document.purgedAt === null && (
										<>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													document &&
													view(
														document,
														DOCUMENTS.find((item) => item.type === type)
															?.label ?? type,
													)
												}
											>
												<IconEye />
												View
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() => document && download(document.id)}
											>
												<IconDownload />
												Download
											</Button>
										</>
									)}
									{document?.status === "awaiting_tenant_consent" && (
										<>
											<Button
												size="sm"
												onClick={() =>
													document &&
													actions.confirm.mutate({
														documentId: document.id,
														decision: "confirm",
														consentAccepted: true,
													})
												}
											>
												Confirm
											</Button>
											<Button
												size="sm"
												variant="outline"
												onClick={() =>
													document &&
													actions.confirm.mutate({
														documentId: document.id,
														decision: "decline",
													})
												}
											>
												Decline
											</Button>
										</>
									)}
									{(canRequest || canUploadReplacement) && (
										<Button
											size="sm"
											variant="outline"
											onClick={() => {
												if (!document) return;
												if (canUploadReplacement) {
													setUpload({ type, requestId: request?.id });
													fileRef.current?.click();
													return;
												}
												const reason = window.prompt(
													"Why do you need a replacement?",
												);
												if (reason?.trim())
													actions.requestUpdate.mutate({
														documentId: document.id,
														reason: reason.trim(),
														consentAccepted: true,
													});
											}}
										>
											{canUploadReplacement
												? "Upload replacement"
												: "Request replacement"}
										</Button>
									)}
								</div>
								{!enabled(type) && type === TENANT_DOCUMENT_TYPES.AADHAAR && (
									<p className="mt-2 text-amber-600 text-xs">
										Aadhaar uploads are temporarily disabled. You can still see
										its card.
									</p>
								)}
								{(!document ||
									document.purgedAt ||
									document.status === "expired" ||
									document.status === "rejected") &&
									enabled(type) &&
									!isOptimistic && (
										<Button
											className="mt-3 w-full"
											size="sm"
											onClick={() => {
												setUpload({ type });
												fileRef.current?.click();
											}}
										>
											{document?.purgedAt ? "Upload again" : "Upload"}
										</Button>
									)}
							</div>
						);
					})}
				</div>
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
							Submit{" "}
							{DOCUMENTS.find((item) => item.type === upload.type)?.label}
						</h2>
						<p className="text-muted-foreground text-sm">
							{upload.file.name} · {(upload.file.size / 1024 / 1024).toFixed(2)}{" "}
							MB
						</p>
						{upload.type === TENANT_DOCUMENT_TYPES.AADHAAR && (
							<>
								<div>
									<Label htmlFor="aadhaar-last-four">Last four digits</Label>
									<Input
										id="aadhaar-last-four"
										inputMode="numeric"
										maxLength={4}
										value={aadhaarLastFour}
										onChange={(e) =>
											setAadhaarLastFour(
												e.target.value.replace(/\D/g, "").slice(0, 4),
											)
										}
										placeholder="e.g. 1234"
									/>
								</div>
								<label className="flex items-start gap-2 text-sm">
									<input
										id="aadhaar-masked"
										type="checkbox"
										className="mt-1"
										checked={maskedConfirmed}
										onChange={(e) => setMaskedConfirmed(e.target.checked)}
									/>{" "}
									This Aadhaar copy is masked.
								</label>
							</>
						)}
						<label className="flex items-start gap-2 text-sm">
							<input
								id="document-consent"
								type="checkbox"
								className="mt-1"
								checked={consentChecked}
								onChange={(e) => setConsentChecked(e.target.checked)}
							/>{" "}
							I consent to sharing this document with my owner for review.
						</label>
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
								disabled={actions.isPending}
								onClick={() => {
									setUpload({ type: upload.type });
									setConsentChecked(false);
									setAadhaarLastFour("");
									setMaskedConfirmed(false);
									setUploadProgress(null);
									setOptimistic(null);
								}}
							>
								Cancel
							</Button>
							<Button onClick={submitUpload} disabled={actions.isPending}>
								{actions.isPending
									? uploadProgress !== null && uploadProgress > 0
										? `${uploadProgress}%`
										: "Uploading…"
									: "Submit"}
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
					onDownload={() => {
						download(viewer.documentId);
					}}
				/>
			)}
		</div>
	);
}

function ProfileRow({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex items-start justify-between px-4 py-3">
			<span className="font-medium text-muted-foreground text-xs">{label}</span>
			<span className="max-w-[60%] text-right font-medium text-sm">
				{value}
			</span>
		</div>
	);
}
