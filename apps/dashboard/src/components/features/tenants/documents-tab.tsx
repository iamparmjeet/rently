"use client";

import { Button } from "@rently/ui/components/button";
import type { TenantDetail } from "@rently/validators";
import { IconFile } from "@tabler/icons-react";
import { toast } from "sonner";

// ── Document type definitions ***********
// WHY static list: these are the document types we intend to support.
// Currently only uid/pan have DB backing (as text fields, not file URLs).
// All others are placeholders pending the R2 tenant-document feature.
//
// TODO: When tenant document uploads are implemented:
//   1. Add URL columns to tenantProfiles: aadhaarDocUrl, panDocUrl, passportUrl, etc.
//   2. Create upload path pattern: tenants/${tenantId}/documents/${docType}.*
//   3. Add server procedure: getPresignedTenantDocumentUrl (similar to owner avatar)
//   4. Replace `isUploaded` logic and `handleUpload` with real R2 flow

interface DocumentType {
	id: string;
	label: string;
	/** Returns true if this document has data in the current tenant profile */
	isUploaded: (tenant: TenantDetail) => boolean;
	/** Display value shown when "uploaded" (e.g. the masked ID number) */
	uploadedHint?: (tenant: TenantDetail) => string | null;
}

const DOCUMENT_TYPES: DocumentType[] = [
	{
		id: "aadhaar",
		label: "Aadhaar Card",
		isUploaded: (t) => !!t.profile?.uidNumber,
		uploadedHint: (t) =>
			t.profile?.uidNumber
				? `XXXX XXXX ${t.profile.uidNumber.slice(-4)}`
				: null,
	},
	{
		id: "pan",
		label: "PAN Card",
		isUploaded: (t) => !!t.profile?.panNumber,
		uploadedHint: (t) => t.profile?.panNumber ?? null,
	},
	{
		id: "passport",
		label: "Passport Photo",
		isUploaded: () => false,
	},
	{
		id: "police",
		label: "Police Verification",
		isUploaded: () => false,
	},
	{
		id: "bank",
		label: "Bank Passbook",
		isUploaded: () => false,
	},
	{
		id: "voter",
		label: "Voter ID",
		isUploaded: () => false,
	},
];

// ── Document card *************

function DocumentCard({
	docType,
	tenant,
}: {
	docType: DocumentType;
	tenant: TenantDetail;
}) {
	const uploaded = docType.isUploaded(tenant);
	const hint = docType.uploadedHint?.(tenant);

	function handleAction() {
		// TODO: Replace with real R2 upload/view flow once tenant document storage is implemented.
		toast.info("Document uploads coming soon.", {
			description:
				"Tenant document storage is being set up. Check back shortly.",
		});
	}

	return (
		<div className="flex flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center">
			{/* Icon */}
			<div className="flex size-12 items-center justify-center rounded-xl bg-primary/10">
				<IconFile className="size-6 text-primary" />
			</div>

			{/* Label + status */}
			<div>
				<p className="font-medium text-sm">{docType.label}</p>
				{uploaded ? (
					<div className="mt-0.5 flex items-center justify-center gap-1 text-emerald-600 text-xs">
						<span>✓</span>
						<span>Uploaded</span>
					</div>
				) : (
					<p className="mt-0.5 text-muted-foreground text-xs">Not uploaded</p>
				)}
				{hint && (
					<p className="mt-0.5 font-mono text-muted-foreground text-xs">
						{hint}
					</p>
				)}
			</div>

			{/* Action */}
			<Button
				variant="outline"
				size="sm"
				className="w-full"
				onClick={handleAction}
			>
				{uploaded ? "View / Replace" : "Upload"}
			</Button>
		</div>
	);
}

// ── Tab component ************

export function DocumentsTab({ tenant }: { tenant: TenantDetail }) {
	return (
		<div>
			<div className="mb-6">
				<h3 className="font-semibold text-base">Documents</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					Identity documents submitted for this tenant. Approved documents
					require a request to update.
				</p>
			</div>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{DOCUMENT_TYPES.map((docType) => (
					<DocumentCard key={docType.id} docType={docType} tenant={tenant} />
				))}
			</div>
		</div>
	);
}
