//rently/apps/web/src/app/(dashboard)/tenants/[id]/page.tsx
"use client";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { useRouter } from "next/navigation";
import {
	TenantCreateForm,
	type TenantCreateFormValues,
} from "@/components/forms/tenant-create-form";
import { useCreateTenant } from "@/hooks/tenants";

export default function TenantsIdPage() {
	const router = useRouter();
	const createTenant = useCreateTenant();

	function handleSubmit(values: TenantCreateFormValues) {
		createTenant.mutate(values, {
			onSuccess: () => {
				router.push("/tenants");
			},
		});
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<Card>
				<CardHeader>
					<CardTitle>New Tenant</CardTitle>
					<CardDescription>
						Add a new tenant to start managing units and leases.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<TenantCreateForm
						onSubmit={handleSubmit}
						isSubmitting={createTenant.isPending}
						submitLabel="Create Tenant"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
