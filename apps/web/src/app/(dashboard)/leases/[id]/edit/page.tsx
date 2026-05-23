// apps/web/src/app/(dashboard)/leases/[id]/edit/page.tsx
"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { use } from "react";
import { LeaseForm, type LeaseFormValues } from "@/components/forms/lease-form";
import { DetailHeader } from "@/components/shared/detail-header";
import { NotFoundState } from "@/components/shared/not-found-state";
import { PageLoader } from "@/components/shared/page-loader";
import { useLease, useUpdateLease } from "@/hooks/leases";
import { useTenants } from "@/hooks/tenants";
import { useUnits } from "@/hooks/units";

export default function EditLeasePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const { data: leaseData, isLoading: leaseLoading } = useLease(id);
	const { data: unitsData } = useUnits();
	const { data: tenantsData } = useTenants();
	const updateLease = useUpdateLease();

	const units = (unitsData?.units ?? []).map((u) => ({
		id: u.id,
		unitNumber: u.unitNumber,
		propertyName: u.propertyName,
		baseRent: u.baseRent,
	}));

	const tenants = tenantsData?.tenants ?? [];

	function handleSubmit(values: LeaseFormValues) {
		updateLease.mutate(
			{
				id,
				data: {
					startDate: new Date(values.startDate),
					endDate: values.endDate ? new Date(values.endDate) : undefined,
					rent: values.rent,
					deposit: values.deposit,
					status: values.status,
				},
			},
			{ onSuccess: () => router.push(`/leases/${id}`) },
		);
	}

	if (leaseLoading) return <PageLoader />;

	if (!leaseData?.lease) return <NotFoundState message="Lease not found." />;

	const { lease } = leaseData;

	// Convert Date objects to strings for HTML date inputs
	const defaultValues: Partial<LeaseFormValues> = {
		unitId: lease.unitId,
		tenantId: lease.tenantId,
		startDate: new Date(lease.startDate).toISOString().split("T")[0],
		endDate: lease.endDate
			? new Date(lease.endDate).toISOString().split("T")[0]
			: undefined,
		rent: lease.rent,
		deposit: lease.deposit ?? undefined,
		status: lease.status,
	};

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<DetailHeader backHref={`/leases/${id}` as Route} title="Edit Lease" />
			<Card>
				<CardHeader>
					<CardTitle>Edit Lease</CardTitle>
					<CardDescription>
						You can update dates, rent, deposit, and status. Unit and tenant
						cannot be changed.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<LeaseForm
						units={units}
						tenants={tenants}
						defaultValues={defaultValues}
						onSubmit={handleSubmit}
						isSubmitting={updateLease.isPending}
						submitLabel="Save Changes"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
