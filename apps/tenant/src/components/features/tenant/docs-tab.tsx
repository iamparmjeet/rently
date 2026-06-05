"use client";

import { cn } from "@rently/ui/lib/utils";
import {
	IconCheck,
	IconClock,
	IconFileText,
	IconUser,
} from "@tabler/icons-react";
import { toast } from "sonner";
import { useTenantLease, useTenantProfile } from "@/hooks/tenant-portal";

interface DocCard {
	key: string;
	label: string;
	valueKey: "uidNumber" | "panNumber";
}

const DOCUMENTS: DocCard[] = [
	{ key: "uid", label: "Aadhaar Card", valueKey: "uidNumber" },
	{ key: "pan", label: "PAN Card", valueKey: "panNumber" },
];

export function DocsTab() {
	const { data: profileData, isLoading } = useTenantProfile();
	const { data: leaseData } = useTenantLease();

	const profile = profileData?.profile;
	const lease = leaseData?.lease;
	const isVerified = profile?.verificationStatus === "verified";

	if (isLoading) {
		return <div className="h-80 animate-pulse rounded-xl bg-muted" />;
	}

	return (
		<div className="space-y-3.5">
			<div>
				<h1 className="font-extrabold text-xl">My Profile & Documents</h1>
				<p className="mt-1 text-muted-foreground text-sm">
					Documents submitted to your landlord. Approved documents require owner
					permission to change.
				</p>
			</div>

			{/* Profile info card */}
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
					{/* Verification badge */}
					<div
						className={cn(
							"ml-auto flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold text-xs",
							isVerified
								? "bg-emerald-500/10 text-emerald-600"
								: "bg-amber-500/10 text-amber-600",
						)}
					>
						{isVerified ? (
							<IconCheck className="h-3 w-3" />
						) : (
							<IconClock className="h-3 w-3" />
						)}
						{isVerified ? "Verified" : "Pending"}
					</div>
				</div>

				{/* Profile details */}
				<div className="divide-y divide-border">
					<ProfileRow label="Phone" value={profile?.phone ?? "Not provided"} />
					<ProfileRow
						label="Address"
						value={profile?.address ?? "Not provided"}
					/>
					{lease && (
						<ProfileRow
							label="Current Unit"
							value={`Unit ${lease.unit.unitNumber}, ${lease.property.name}`}
						/>
					)}
					{profile?.emergencyContactName && (
						<ProfileRow
							label="Emergency Contact"
							value={`${profile.emergencyContactName}${profile.emergencyContact ? ` · ${profile.emergencyContact}` : ""}`}
						/>
					)}
				</div>
			</div>

			{/* KYC documents grid */}
			<div>
				<p className="mb-2.5 font-bold text-sm">KYC Documents</p>
				<div className="grid grid-cols-2 gap-2.5">
					{DOCUMENTS.map((doc) => {
						const value = profile?.[doc.valueKey];
						const hasDoc = Boolean(value);
						const verified = hasDoc && isVerified;

						return (
							<div
								key={doc.key}
								className="flex flex-col items-center rounded-xl border bg-background p-4 text-center"
							>
								<div
									className={cn(
										"mb-2.5 flex h-11 w-11 items-center justify-center rounded-lg",
										verified
											? "bg-primary/10 text-primary"
											: hasDoc
												? "bg-amber-500/10 text-amber-600"
												: "bg-muted text-muted-foreground",
									)}
								>
									<IconFileText className="h-5 w-5" />
								</div>
								<p className="font-semibold text-sm">{doc.label}</p>
								<p
									className={cn(
										"mt-0.5 text-xs",
										verified
											? "text-emerald-600"
											: hasDoc
												? "text-amber-600"
												: "text-muted-foreground",
									)}
								>
									{verified
										? "✓ Verified"
										: hasDoc
											? "Uploaded — pending"
											: "Not uploaded"}
								</p>
								<button
									type="button"
									className={cn(
										"mt-3 h-8 w-full rounded-md border font-medium text-xs transition-colors",
										verified
											? "border-border bg-muted hover:bg-muted/80"
											: "border-primary bg-primary text-primary-foreground hover:bg-primary/90",
									)}
									onClick={() =>
										toast.info(
											verified
												? `${doc.label} is verified.`
												: hasDoc
													? `${doc.label} is pending owner review.`
													: "Document upload coming soon.",
										)
									}
								>
									{verified ? "View" : hasDoc ? "Pending" : "Upload"}
								</button>
							</div>
						);
					})}
				</div>
			</div>

			{/* Document change request banner */}
			<div className="rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-3.5">
				<p className="font-semibold text-amber-600 text-sm">
					⚠️ Document Change Request
				</p>
				<p className="mt-1 text-muted-foreground text-xs">
					Need to update an approved document? Changes require owner approval.
				</p>
				<button
					type="button"
					onClick={() =>
						toast.info("Document change request sent to your landlord.")
					}
					className="mt-2.5 h-8 rounded-md border border-amber-500/50 px-3.5 font-medium text-amber-600 text-xs transition-colors hover:bg-amber-500/10"
				>
					Request Document Change
				</button>
			</div>
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
