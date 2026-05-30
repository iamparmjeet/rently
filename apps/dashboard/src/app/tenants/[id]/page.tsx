// apps/web/src/app/(dashboard)/tenants/[id]/page.tsx
"use client";

// Component tree:
// TenantDetailPage
//   ├── Loading skeleton
//   ├── Not found state
//   ├── Back button + Edit action
//   ├── TenantHeroCard (avatar, name, status badge, email, phone)
//   ├── LeaseInfoCard (property, unit, rent, end date) or empty state
//   ├── ProfileCard (address, emergency contacts)
//   └── DangerZone (remove tenant with ConfirmDialog)

import { useSendPasswordReset } from "@rently/hooks";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { SendEmailDialog } from "@rently/ui/shared/send-email-dialog";
import {
	IconArrowLeft,
	IconBuilding,
	IconCalendar,
	IconId,
	IconKey,
	IconMail,
	IconMapPin,
	IconPencil,
	IconPhone,
	IconShieldCheck,
	IconUser,
	IconUserMinus,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { useRemoveTenant, useTenant } from "@/hooks/tenants";

// ── Verification status visual map ──────────────────────────────────────────
const verificationBadge = {
	unverified: { label: "Unverified", variant: "secondary" as const },
	pending: { label: "Pending Review", variant: "outline" as const },
	verified: { label: "Verified", variant: "default" as const },
	rejected: { label: "Rejected", variant: "destructive" as const },
};

// ── Sub-component: a single detail row ──────────────────────────────────────
function DetailRow({
	icon: Icon,
	label,
	value,
}: {
	icon: React.ComponentType<{ className?: string }>;
	label: string;
	value: string | null | undefined;
}) {
	if (!value) return null;
	return (
		<div className="flex items-start gap-3 py-2">
			<Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
			<div className="min-w-0">
				<p className="text-muted-foreground text-xs">{label}</p>
				<p className="truncate font-medium text-sm">{value}</p>
			</div>
		</div>
	);
}

export default function TenantDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const { data, isLoading, isError, error } = useTenant(id);
	const removeTenant = useRemoveTenant();
	const sendPasswordReset = useSendPasswordReset();

	function handlePasswordReset() {
		sendPasswordReset.mutate({ tenantId: id });
	}

	// ── Loading skeleton ───────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="col-span-12 space-y-4">
				<div className="h-8 w-36 animate-pulse rounded bg-muted" />
				<div className="h-40 animate-pulse rounded-xl bg-muted" />
				<div className="h-48 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	// ── Error / not found ──────────────────────────────────────────────────
	if (isError || !data?.tenant) {
		return (
			<div className="col-span-12 flex flex-col items-center justify-center py-20 text-center">
				<p className="text-muted-foreground">
					{isError ? error.message : "Tenant not found."}
				</p>
				<Button variant="outline" className="mt-4">
					<Link href="/tenants">Back to Tenants</Link>
				</Button>
			</div>
		);
	}

	const { tenant } = data;
	const { profile, currentLease } = tenant;

	function handleRemove() {
		removeTenant.mutate(
			{ tenantId: id },
			{ onSuccess: () => router.push("/tenants") },
		);
	}

	return (
		<div className="col-span-12 space-y-6">
			{/* ── Top bar: back + actions ──────────────────────────────── */}
			<div className="flex items-center justify-between">
				<Button variant="ghost" size="icon">
					<Link href="/tenants">
						<IconArrowLeft className="size-4" />
					</Link>
				</Button>
				{/* Send custom email */}
				<SendEmailDialog
					tenantId={id}
					tenantName={tenant.name}
					trigger={
						<Button variant="outline" size="icon" title="Send email to tenant">
							<IconMail className="size-4" />
						</Button>
					}
				/>

				{/* Re-send password reset */}
				<ConfirmDialog
					title="Send Password Reset Email"
					description={`This will send a password reset link to ${tenant.email}. Use this if the tenant lost or never received their setup email.`}
					confirmLabel="Send Reset Email"
					onConfirm={handlePasswordReset}
					isLoading={sendPasswordReset.isPending}
					trigger={
						<Button
							variant="outline"
							size="icon"
							title="Send password reset email"
							disabled={sendPasswordReset.isPending}
						>
							<IconKey className="size-4" />
						</Button>
					}
				/>
				<Button variant="outline">
					<Link
						href={`/tenants/${id}/edit`}
						className="flex items-center gap-2"
					>
						<IconPencil className="size-4" />
						Edit Profile
					</Link>
				</Button>
			</div>

			{/* ── Hero card: identity ───────────────────────────────────── */}
			<Card>
				<CardContent className="flex items-start gap-4 pt-6">
					{/* Avatar */}
					<div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-muted">
						{tenant.avatarUrl ? (
							<img
								src={tenant.avatarUrl}
								alt={tenant.name}
								className="size-full rounded-full object-cover"
							/>
						) : (
							<IconUser className="size-8 text-muted-foreground" />
						)}
					</div>

					{/* Name + status */}
					<div className="min-w-0 flex-1">
						<h1 className="truncate font-semibold text-xl">{tenant.name}</h1>
						<Badge variant="secondary" className="mt-1 capitalize">
							{tenant.status}
						</Badge>

						{/* Quick contact */}
						<div className="mt-3 space-y-1">
							<div className="flex items-center gap-2 text-muted-foreground text-sm">
								<IconMail className="size-4 shrink-0" />
								<span className="truncate">{tenant.email}</span>
							</div>
							{tenant.phone && (
								<div className="flex items-center gap-2 text-muted-foreground text-sm">
									<IconPhone className="size-4 shrink-0" />
									<span>{tenant.phone}</span>
								</div>
							)}
						</div>
					</div>

					{/* Verification badge (if profile exists) */}
					{profile && (
						<div className="shrink-0">
							<Badge
								variant={
									verificationBadge[profile.verificationStatus]?.variant ??
									"secondary"
								}
								className="flex items-center gap-1"
							>
								<IconShieldCheck className="size-3" />
								{verificationBadge[profile.verificationStatus]?.label ??
									"Unknown"}
							</Badge>
						</div>
					)}
				</CardContent>
			</Card>

			{/* ── Current Lease ─────────────────────────────────────────── */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconBuilding className="size-5 text-muted-foreground" />
						<CardTitle className="text-base">Current Lease</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{currentLease ? (
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
							<div>
								<p className="text-muted-foreground text-xs">Property</p>
								<p className="font-medium text-sm">
									{currentLease.propertyName}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">Unit</p>
								<p className="font-medium text-sm">
									Unit {currentLease.unitNumber}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">Monthly Rent</p>
								<p className="font-semibold text-sm">
									₹{currentLease.rent.toLocaleString("en-IN")}
								</p>
							</div>
							<div>
								<p className="text-muted-foreground text-xs">Lease End</p>
								<div className="flex items-center gap-1">
									<IconCalendar className="size-3 text-muted-foreground" />
									<p className="font-medium text-sm">
										{currentLease.endDate
											? new Date(currentLease.endDate).toLocaleDateString(
													"en-IN",
													{ day: "2-digit", month: "short", year: "numeric" },
												)
											: "Ongoing"}
									</p>
								</div>
							</div>
						</div>
					) : (
						<div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
							No active lease
						</div>
					)}
				</CardContent>
			</Card>

			{/* ── Profile: Contact + Emergency ─────────────────────────── */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconId className="size-5 text-muted-foreground" />
						<CardTitle className="text-base">Profile Details</CardTitle>
					</div>
				</CardHeader>
				<CardContent>
					{profile ? (
						<div className="divide-y">
							<div className="pb-3">
								<h3 className="mb-2 font-medium text-sm">Contact</h3>
								<DetailRow
									icon={IconMapPin}
									label="Address"
									value={profile.address}
								/>
								{!profile.address && (
									<p className="text-muted-foreground text-sm">
										No address on file.
									</p>
								)}
							</div>
							<div className="pt-3">
								<h3 className="mb-2 font-medium text-sm">Emergency Contact</h3>
								<DetailRow
									icon={IconUser}
									label="Name"
									value={profile.emergencyContactName}
								/>
								<DetailRow
									icon={IconPhone}
									label="Phone"
									value={profile.emergencyContact}
								/>
								<DetailRow
									icon={IconMapPin}
									label="Location"
									value={profile.emergencyContactLocation}
								/>
								{!profile.emergencyContact && !profile.emergencyContactName && (
									<p className="text-muted-foreground text-sm">
										No emergency contact on file.
									</p>
								)}
							</div>
						</div>
					) : (
						<div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
							Profile not yet completed.{" "}
							<Link
								href={`/tenants/${id}/edit`}
								className="text-primary hover:underline"
							>
								Add details
							</Link>
						</div>
					)}
				</CardContent>
			</Card>

			{/* ── Danger Zone ───────────────────────────────────────────── */}
			<Card className="border-destructive/30">
				<CardHeader>
					<CardTitle className="flex items-center gap-2 text-base text-destructive">
						<IconUserMinus className="size-5" />
						Danger Zone
					</CardTitle>
				</CardHeader>
				<CardContent>
					<p className="mb-4 text-muted-foreground text-sm">
						Removing a tenant terminates all active leases on your properties
						and frees those units. The tenant's account is not deleted.
					</p>
					<ConfirmDialog
						title="Remove Tenant"
						description={`Are you sure you want to remove ${tenant.name}? All active leases will be terminated and units freed.`}
						confirmLabel="Remove Tenant"
						destructive
						onConfirm={handleRemove}
						isLoading={removeTenant.isPending}
						trigger={
							<Button
								variant="destructive"
								size="sm"
								disabled={removeTenant.isPending}
							>
								<IconUserMinus className="mr-2 size-4" />
								Remove Tenant
							</Button>
						}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
