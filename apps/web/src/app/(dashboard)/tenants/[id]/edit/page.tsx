// apps/web/src/app/(dashboard)/tenants/[id]/edit/page.tsx
"use client";

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconArrowLeft } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import {
	TenantProfileForm,
	type TenantProfileFormValues,
} from "@/components/forms/tenant-profile-form";
import { useTenant, useUpdateTenant } from "@/hooks/tenants";

export default function EditTenantPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const { data, isLoading } = useTenant(id);
	const updateTenant = useUpdateTenant();

	// ── Loading skeleton ───────────────────────────────────────────────────
	if (isLoading) {
		return (
			<div className="col-span-12 mx-auto w-full max-w-lg space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-96 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	if (!data?.tenant) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				Tenant not found.
			</div>
		);
	}

	const { tenant } = data;

	function handleSubmit(values: TenantProfileFormValues) {
		updateTenant.mutate(
			{ tenantId: id, ...values },
			{ onSuccess: () => router.push(`/tenants/${id}`) },
		);
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			{/* Back nav */}
			<div className="mb-4 flex items-center gap-2">
				<Button variant="ghost" size="icon">
					<Link href={`/tenants/${id}`}>
						<IconArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold text-xl">Edit {tenant.name}</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Edit Tenant Profile</CardTitle>
					<CardDescription>
						Update contact and emergency information. Identity fields (name,
						email) and KYC documents require a separate request flow.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TenantProfileForm
						tenantName={tenant.name}
						tenantEmail={tenant.email}
						uidNumber={tenant.profile?.uidNumber}
						panNumber={tenant.profile?.panNumber}
						defaultValues={{
							phone: tenant.phone ?? undefined,
							address: tenant.profile?.address ?? undefined,
							emergencyContact: tenant.profile?.emergencyContact ?? undefined,
							emergencyContactName:
								tenant.profile?.emergencyContactName ?? undefined,
							emergencyContactLocation:
								tenant.profile?.emergencyContactLocation ?? undefined,
						}}
						onSubmit={handleSubmit}
						isSubmitting={updateTenant.isPending}
						submitLabel="Save Changes"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
