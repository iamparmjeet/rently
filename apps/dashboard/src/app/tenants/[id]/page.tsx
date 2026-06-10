"use client";

import { useSendPasswordReset } from "@rently/hooks";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { Separator } from "@rently/ui/components/separator";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { DetailHeader } from "@rently/ui/shared/detail-header";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { SendEmailDialog } from "@rently/ui/shared/send-email-dialog";
import {
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
import Image from "next/image";
import { useRouter } from "next/navigation";
import { use } from "react";
import {
	TenantProfileForm,
	type TenantProfileFormValues,
} from "@/components/forms/tenant-profile-form";
import { Container } from "@/components/shared/container";
import { useRemoveTenant, useTenant, useUpdateTenant } from "@/hooks/tenants";

// ── Verification status visual map
// Record<string, …>: drizzle-zod infers verificationStatus as `string` at
// runtime even if the DB enum is narrower. Using a Record with a fallback is
// safer than indexing into a plain object literal with a typed key that may
// not exist.
const verificationBadge: Record<
	string,
	{
		label: string;
		variant: "secondary" | "outline" | "default" | "destructive";
	}
> = {
	unverified: { label: "Unverified", variant: "secondary" },
	pending: { label: "Pending Review", variant: "outline" },
	verified: { label: "Verified", variant: "default" },
	rejected: { label: "Rejected", variant: "destructive" },
};

//  Sub-component: a single labelled detail row
// Renders nothing if value is falsy — callers don't need null-guard wrappers.
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

// ─────────────────────────────────────────────────────────────────────────────

export default function TenantDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const editDialog = useFormDialog();

	const { data, isLoading, isError, error } = useTenant(id);
	const removeTenant = useRemoveTenant();
	const sendPasswordReset = useSendPasswordReset();
	const updateTenant = useUpdateTenant();

	function handlePasswordReset() {
		sendPasswordReset.mutate({ tenantId: id });
	}

	function handleEdit(values: TenantProfileFormValues) {
		const { name, email, phone, ...profileFields } = values;
		updateTenant.mutate(
			{ tenantId: tenant.id, name, email, phone, ...profileFields },
			{ onSuccess: editDialog.closeDialog },
		);
	}

	//  Loading skeleton
	if (isLoading) {
		return (
			<Container>
				<div className="col-span-12 space-y-4">
					<div className="flex items-center justify-between">
						<div className="h-7 w-40 animate-pulse rounded bg-muted" />
						<div className="flex gap-2">
							<div className="h-7 w-20 animate-pulse rounded bg-muted" />
							<div className="h-7 w-28 animate-pulse rounded bg-muted" />
							<div className="h-7 w-16 animate-pulse rounded bg-muted" />
						</div>
					</div>
					<div className="h-36 animate-pulse rounded-lg bg-muted" />
					<div className="h-44 animate-pulse rounded-lg bg-muted" />
					<div className="h-52 animate-pulse rounded-lg bg-muted" />
				</div>
			</Container>
		);
	}

	// ── Error / not found ──────────────────────────────────────────────────────
	if (isError || !data?.tenant) {
		return (
			<Container>
				<NotFoundState
					message={isError ? error.message : "Tenant not found."}
				/>
			</Container>
		);
	}

	const { tenant } = data;
	const { profile, currentLease } = tenant;

	const verification = profile
		? (verificationBadge[profile.verificationStatus] ??
			verificationBadge.unverified)
		: null;

	function handleRemove() {
		removeTenant.mutate(
			{ tenantId: id },
			{ onSuccess: () => router.push("/tenants") },
		);
	}

	return (
		<Container>
			<div className="col-span-12 space-y-6">
				{/*  Header: back + name + actions  */}
				<DetailHeader
					backHref="/tenants"
					title={tenant.name}
					subtitle={tenant.email}
				>
					<SendEmailDialog
						tenantId={id}
						tenantName={tenant.name}
						trigger={
							<Button variant="outline" size="sm">
								<IconMail className="size-3.5" />
								Email
							</Button>
						}
					/>

					<ConfirmDialog
						title="Send Password Reset Email"
						description={`This will send a password reset link to ${tenant.email}. Use this if the tenant lost or never received their setup email.`}
						confirmLabel="Send Reset Email"
						onConfirm={handlePasswordReset}
						isLoading={sendPasswordReset.isPending}
						trigger={
							<Button
								variant="outline"
								size="sm"
								disabled={sendPasswordReset.isPending}
							>
								<IconKey className="size-3.5" />
								Reset Password
							</Button>
						}
					/>

					<Button variant="outline" size="sm" onClick={editDialog.openDialog}>
						<IconPencil className="size-3.5" />
						Edit
					</Button>
				</DetailHeader>

				{/*  Hero: avatar + status + contact  */}
				<Card>
					<CardContent className="pt-5">
						<div className="flex items-start gap-5">
							<div className="flex size-20 shrink-0 items-center justify-center rounded-full bg-muted ring-2 ring-border">
								{tenant.avatarUrl ? (
									<Image
										src={tenant.avatarUrl}
										alt={tenant.name}
										width={80}
										height={80}
										className="size-full rounded-full object-cover"
									/>
								) : (
									<IconUser className="size-9 text-muted-foreground" />
								)}
							</div>

							<div className="min-w-0 flex-1 space-y-3">
								<div className="flex flex-wrap items-center gap-2">
									<Badge variant="secondary" className="capitalize">
										{tenant.status}
									</Badge>
									{verification && (
										<Badge
											variant={verification.variant}
											className="flex items-center gap-1"
										>
											<IconShieldCheck className="size-3" />
											{verification.label}
										</Badge>
									)}
								</div>

								<div className="space-y-1.5">
									<div className="flex items-center gap-2 text-muted-foreground text-sm">
										<IconMail className="size-3.5 shrink-0" />
										<span className="truncate">{tenant.email}</span>
									</div>
									{tenant.phone && (
										<div className="flex items-center gap-2 text-muted-foreground text-sm">
											<IconPhone className="size-3.5 shrink-0" />
											<span>{tenant.phone}</span>
										</div>
									)}
								</div>
							</div>
						</div>
					</CardContent>
				</Card>

				{/*  Current Lease  */}
				<Card>
					<CardHeader className="border-b">
						<CardTitle className="flex items-center gap-2">
							<IconBuilding className="size-4 text-muted-foreground" />
							Current Lease
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-4">
						{currentLease ? (
							<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
								<div>
									<p className="text-muted-foreground text-xs">Property</p>
									<p className="mt-0.5 font-medium text-sm">
										{currentLease.propertyName}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Unit</p>
									<p className="mt-0.5 font-medium text-sm">
										Unit {currentLease.unitNumber}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Monthly Rent</p>
									<p className="mt-0.5 font-semibold text-base">
										₹{currentLease.rent.toLocaleString("en-IN")}
									</p>
								</div>
								<div>
									<p className="text-muted-foreground text-xs">Lease End</p>
									<div className="mt-0.5 flex items-center gap-1">
										<IconCalendar className="size-3 shrink-0 text-muted-foreground" />
										<p className="font-medium text-sm">
											{currentLease.endDate
												? new Date(currentLease.endDate).toLocaleDateString(
														"en-IN",
														{
															day: "2-digit",
															month: "short",
															year: "numeric",
														},
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

				{/*  Profile Details  */}
				<Card>
					<CardHeader className="border-b">
						<CardTitle className="flex items-center gap-2">
							<IconId className="size-4 text-muted-foreground" />
							Profile Details
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-4">
						{profile ? (
							<div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
								<div>
									<p className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Contact
									</p>
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

								<Separator className="sm:hidden" />

								<div>
									<p className="mb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
										Emergency Contact
									</p>
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
									{!profile.emergencyContact &&
										!profile.emergencyContactName && (
											<p className="text-muted-foreground text-sm">
												No emergency contact on file.
											</p>
										)}
								</div>
							</div>
						) : (
							<div className="rounded-lg border border-dashed py-8 text-center text-muted-foreground text-sm">
								Profile not yet completed.{" "}
								{/* WHY <button> not <Link>: the edit page no longer exists.
								    This opens the dialog instead of navigating away. */}
								<button
									type="button"
									onClick={editDialog.openDialog}
									className="text-primary hover:underline"
								>
									Add details
								</button>
							</div>
						)}
					</CardContent>
				</Card>

				{/*  Danger Zone  */}
				<Card className="border-destructive/30">
					<CardHeader className="border-b">
						<CardTitle className="flex items-center gap-2 text-destructive">
							<IconUserMinus className="size-4" />
							Danger Zone
						</CardTitle>
					</CardHeader>
					<CardContent className="pt-4">
						<div className="flex items-start justify-between gap-6">
							<p className="text-muted-foreground text-sm">
								Removing a tenant terminates all active leases and frees those
								units. The tenant's account is not deleted.
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
										className="shrink-0"
									>
										<IconUserMinus className="size-3.5" />
										Remove
									</Button>
								}
							/>
						</div>
					</CardContent>
				</Card>

				{/*  Edit Profile Dialog  */}
				<FormDialog
					open={editDialog.open}
					onOpenChange={editDialog.onOpenChange}
					title="Edit Tenant Profile"
					description="Update contact and emergency details. Identity fields and KYC documents require a separate request flow."
					formId="edit-tenant-form"
					isSubmitting={updateTenant.isPending}
					submitLabel="Save Changes"
					size="lg"
				>
					<TenantProfileForm
						// WHY key: forces a full remount when the dialog opens.
						// Without it, defaultValues from the previous open are still
						// in RHF's internal state when you open the dialog a second time.
						key={editDialog.open ? "open" : "closed"}
						formId="edit-tenant-form"
						uidNumber={profile?.uidNumber}
						panNumber={profile?.panNumber}
						defaultValues={{
							name: tenant.name,
							email: tenant.email,
							phone: tenant.phone ?? undefined,
							address: profile?.address ?? undefined,
							emergencyContact: profile?.emergencyContact ?? undefined,
							emergencyContactName: profile?.emergencyContactName ?? undefined,
							emergencyContactLocation:
								profile?.emergencyContactLocation ?? undefined,
						}}
						onSubmit={handleEdit}
						isSubmitting={updateTenant.isPending}
					/>
				</FormDialog>
			</div>
		</Container>
	);
}
