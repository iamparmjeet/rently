// apps/web/src/app/(dashboard)/leases/new/page.tsx
"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { DetailHeader } from "@rently/ui/shared/detail-header";
import { useRouter } from "next/navigation";
import { LeaseForm, type LeaseFormValues } from "@/components/forms/lease-form";
import { useCreateLease } from "@/hooks/leases";
import { useTenants } from "@/hooks/tenants";
import { useUnits } from "@/hooks/units"; // you'll add this

export default function NewLeasePage() {
	const router = useRouter();
	const createLease = useCreateLease();
	const { data: unitsData } = useUnits();
	const { data: tenantsData } = useTenants();

	// Only show available units for new lease creation
	const availableUnits = (unitsData?.units ?? [])
		.filter((u) => u.status === "available")
		.map((u) => ({
			id: u.id,
			unitNumber: u.unitNumber,
			propertyName: u.propertyName ?? "",
			baseRent: u.baseRent,
		}));

	const tenants = tenantsData?.tenants ?? [];

	function handleSubmit(values: LeaseFormValues) {
		createLease.mutate(
			{
				...values,
				startDate: new Date(values.startDate),
				endDate: values.endDate ? new Date(values.endDate) : undefined,
			},
			{ onSuccess: () => router.push("/leases") },
		);
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<DetailHeader backHref="/leases" title="New Lease" />
			<Card className="mt-4">
				<CardHeader>
					<CardTitle>Create Lease</CardTitle>
					<CardDescription>
						Create a rental agreement between a unit and a tenant.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<LeaseForm
						units={availableUnits}
						tenants={tenants}
						onSubmit={handleSubmit}
						isSubmitting={createLease.isPending}
						submitLabel="Create Lease"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
