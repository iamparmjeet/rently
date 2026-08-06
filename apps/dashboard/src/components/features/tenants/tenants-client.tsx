"use client";

import type { InviteStatus } from "@rently/db/constants/rent-constants";
import { Button } from "@rently/ui/components/button";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { PageHeader } from "@rently/ui/shared/page-header";
import { IconMail, IconPlus } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { TenantCard } from "@/components/features/tenants/tenant-card";
import {
	InviteForm,
	type InviteFormValues,
} from "@/components/forms/invite-form";
import {
	TenantCreateForm,
	type TenantCreateFormValues,
} from "@/components/forms/tenant-create-form";
import { Container } from "@/components/shared/container";
import { useCreateInvite } from "@/hooks/invites";
import { useCreateTenant, useSuspenseTenants } from "@/hooks/tenants";

type StatusFilter = "all" | InviteStatus;

export default function TenantsClientPage() {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	//  Data
	const { data } = useSuspenseTenants();

	const filtered = useMemo(() => {
		if (!data?.tenants) return [];
		if (statusFilter === "all") return data.tenants;
		return data.tenants.filter((t) => t.status === statusFilter);
	}, [data?.tenants, statusFilter]);

	//  Dialogs
	// WHY two separate useFormDialog instances: each controls its own open/close
	// state independently. Opening one doesn't affect the other.
	const inviteDialog = useFormDialog();
	const addDialog = useFormDialog();

	//  Mutations
	const createInvite = useCreateInvite();
	const createTenant = useCreateTenant();

	//  Handlers
	function handleInvite(values: InviteFormValues) {
		createInvite.mutate(values, {
			onSuccess: inviteDialog.closeDialog,
		});
	}

	function handleAddManually(values: TenantCreateFormValues) {
		createTenant.mutate(values, {
			onSuccess: addDialog.closeDialog,
		});
	}

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				{/* Header */}
				<PageHeader
					title="Tenants"
					description="Manage your tenants and their rental agreements"
				>
					<Button size="lg" variant="outline" onClick={inviteDialog.openDialog}>
						<IconMail className="mr-2 size-4" />
						Invite Tenant
					</Button>
					<Button size="lg" onClick={addDialog.openDialog}>
						<IconPlus className="mr-2 size-4" />
						Prepare Invitation
					</Button>
				</PageHeader>

				{/* Status filter tabs */}
				<div className="flex gap-2">
					{(["all", "accepted", "pending", "expired"] as const).map((s) => (
						<Button
							key={s}
							variant={statusFilter === s ? "default" : "outline"}
							size="sm"
							onClick={() => setStatusFilter(s)}
							className="capitalize"
						>
							{s}
						</Button>
					))}
				</div>

				{/* Content states */}
				{filtered.length === 0 ? (
					<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
						<p className="text-muted-foreground">
							{data?.tenants.length === 0
								? "No tenants yet. Invite your first one!"
								: "No tenants match this filter."}
						</p>
						{data?.tenants.length === 0 && (
							<div className="mt-4 flex gap-2">
								{/* WHY onClick here too: empty state buttons must open the
							    same dialogs as the header buttons — no separate
							    navigation, consistent with the rest of the app. */}
								<Button
									size="lg"
									variant="outline"
									onClick={inviteDialog.openDialog}
								>
									<IconMail className="mr-1.5 size-4" />
									Invite Tenant
								</Button>
								<Button onClick={addDialog.openDialog}>
									<IconPlus className="mr-1.5 size-4" />
									Prepare Invitation
								</Button>
							</div>
						)}
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{filtered.map((tenant) => (
							<TenantCard key={tenant.id} tenant={tenant} />
						))}
					</div>
				)}

				{/*  Invite Tenant dialog */}
				<FormDialog
					open={inviteDialog.open}
					onOpenChange={inviteDialog.onOpenChange}
					title="Invite Tenant"
					description="An email with a sign-up link will be sent to the tenant. The invite expires in 7 days."
					formId="invite-tenant-form"
					isSubmitting={createInvite.isPending}
					submitLabel="Send Invite"
				>
					<InviteForm
						formId="invite-tenant-form"
						onSubmit={handleInvite}
						isSubmitting={createInvite.isPending}
					/>
				</FormDialog>

				{/* Owner-prepared invitation dialog */}
				<FormDialog
					open={addDialog.open}
					onOpenChange={addDialog.onOpenChange}
					title="Prepare Tenant Invitation"
					description="Save the tenant's details and send an invitation. The tenant sets their password and accepts the invitation before an account is created."
					formId="add-tenant-form"
					isSubmitting={createTenant.isPending}
					submitLabel="Send Tenant Invitation"
				>
					<TenantCreateForm
						formId="add-tenant-form"
						onSubmit={handleAddManually}
						isSubmitting={createTenant.isPending}
					/>
				</FormDialog>
			</div>
		</Container>
	);
}
