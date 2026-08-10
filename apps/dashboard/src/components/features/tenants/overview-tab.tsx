"use client";

import { Badge } from "@rently/ui/components/badge";
import { formatRupees } from "@rently/ui/lib/currency";
import type { Lease, TenantDetail } from "@rently/validators";
import Link from "next/link";

interface OverviewTabProps {
	tenant: TenantDetail;
	lease: Lease | null | undefined;
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="space-y-0.5">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-medium text-sm">{value ?? "—"}</p>
		</div>
	);
}

function SectionHeading({ children }: { children: React.ReactNode }) {
	return (
		<p className="mb-4 font-semibold text-muted-foreground text-xs uppercase tracking-wide">
			{children}
		</p>
	);
}

export function OverviewTab({ tenant, lease }: OverviewTabProps) {
	const { profile, currentLease, activeLeases } = tenant;

	const leaseStartFormatted = lease?.startDate
		? new Date(lease.startDate).toLocaleDateString("en-IN", {
				month: "short",
				year: "numeric",
			})
		: "—";

	const leaseEndFormatted = currentLease?.endDate
		? new Date(currentLease.endDate).toLocaleDateString("en-IN", {
				month: "short",
				year: "numeric",
			})
		: "Ongoing";

	return (
		<div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
			{/* ── Left column: Personal + Lease ************ */}
			<div className="space-y-8 lg:col-span-2">
				{/* All active units */}
				<section>
					<SectionHeading>
						Active Units / Leases ({activeLeases.length})
					</SectionHeading>
					{activeLeases.length === 0 ? (
						<p className="rounded-md border border-dashed px-3 py-6 text-center text-muted-foreground text-sm">
							No active leases
						</p>
					) : (
						<div className="space-y-3">
							{activeLeases.map((activeLease) => (
								<div
									key={activeLease.id}
									className="flex items-center justify-between gap-4 rounded-lg border p-4"
								>
									<div className="min-w-0">
										<p className="font-medium text-sm">
											{activeLease.propertyName}
										</p>
										<p className="mt-1 text-muted-foreground text-sm">
											Unit {activeLease.unitNumber} ·{" "}
											{formatRupees(activeLease.rent)}/mo
										</p>
									</div>
									<div className="flex shrink-0 items-center gap-3">
										<Badge variant="outline">
											{activeLease.endDate
												? `Until ${new Date(activeLease.endDate).toLocaleDateString("en-IN")}`
												: "Ongoing"}
										</Badge>
										<Link
											href={`/leases/${activeLease.id}`}
											className="font-medium text-primary text-sm hover:underline"
										>
											View lease
										</Link>
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				{/* Personal Information */}
				<section>
					<SectionHeading>Personal Information</SectionHeading>
					<div className="grid grid-cols-2 gap-6">
						<InfoRow label="Email" value={tenant.email} />
						<InfoRow label="Phone" value={tenant.phone} />
						<InfoRow label="Property" value={currentLease?.propertyName} />
						<InfoRow
							label="Unit"
							value={
								currentLease ? `Unit ${currentLease.unitNumber}` : undefined
							}
						/>
						<InfoRow label="Lease Since" value={leaseStartFormatted} />
						<InfoRow
							label="Status"
							value={
								<Badge variant="outline" className="capitalize">
									{tenant.status}
								</Badge>
							}
						/>
					</div>
				</section>

				{/* Current Lease Details */}
				{currentLease && (
					<section>
						<SectionHeading>Current Lease Details</SectionHeading>
						<div className="grid grid-cols-2 gap-6">
							<InfoRow label="Start" value={leaseStartFormatted} />
							<InfoRow label="End" value={leaseEndFormatted} />
							<InfoRow
								label="Rent"
								value={`${formatRupees(currentLease.rent)}/mo`}
							/>
							<InfoRow
								label="Deposit"
								value={
									lease?.deposit != null ? formatRupees(lease.deposit) : "—"
								}
							/>
							<InfoRow
								label="Notice Period"
								value={lease?.notice ? `${lease.notice} days` : "—"}
							/>
							<InfoRow
								label="Rent Due"
								value={
									lease?.rentDueDate
										? `${lease.rentDueDate}${ordinal(lease.rentDueDate)} of month`
										: "—"
								}
							/>
						</div>
					</section>
				)}

				{/* Emergency Contact */}
				{profile && (
					<section>
						<SectionHeading>Emergency Contact</SectionHeading>
						<div className="grid grid-cols-2 gap-6">
							<InfoRow label="Name" value={profile.emergencyContactName} />
							<InfoRow label="Phone" value={profile.emergencyContact} />
							<InfoRow
								label="Location"
								value={profile.emergencyContactLocation}
							/>
						</div>
					</section>
				)}
			</div>

			{/* ── Right column: Owner Notes + Reference *********** */}
			<div className="space-y-6">
				{/* TODO: Wire up once `notes` column is added to tenantProfiles.
				    Migration needed: ALTER TABLE tenant_profiles ADD COLUMN notes TEXT;
				    Then add to UpdateTenantProfileSchema + getTenantById output. */}
				<section>
					<SectionHeading>
						Owner Notes{" "}
						<span className="text-xs normal-case">
							(Private — not visible to tenant)
						</span>
					</SectionHeading>
					<textarea
						className="h-28 w-full resize-none rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
						placeholder="Add private notes..."
						disabled
					/>
					<p className="mt-1 text-muted-foreground text-xs">
						Notes feature coming soon.
					</p>
				</section>

				{/* TODO: Reference section needs DB schema additions.
				    The `referrers` table needs: referredByName, referredByContact, relationship fields. */}
				<section>
					<SectionHeading>Reference</SectionHeading>
					<p className="text-muted-foreground text-sm">
						Reference tracking coming soon.
					</p>
				</section>
			</div>
		</div>
	);
}

// Ordinal helper for rent due date: 1 → "1st", 2 → "2nd", 3 → "3rd"
function ordinal(n: number): string {
	const s = ["th", "st", "nd", "rd"];
	const v = n % 100;
	return s[(v - 20) % 10] ?? s[v] ?? s[0] ?? "th";
}
