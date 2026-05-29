"use client";

import { Card, CardContent } from "@rently/ui/components/card";
import { useRouter } from "next/navigation";
import {
	PropertyForm,
	type PropertyFormValues,
} from "@/components/forms/property-form";
import { DetailHeader } from "@/components/shared/detail-header";
import { useCreateProperty } from "@/hooks/properties";

export default function NewPropertyPage() {
	const router = useRouter();
	const createProperty = useCreateProperty();

	function handleSubmit(values: PropertyFormValues) {
		createProperty.mutate(values, {
			// onSuccess here is "after this specific mutation call"
			// The hook's onSuccess (toast + invalidate) still runs
			onSuccess: () => {
				router.push("/properties");
			},
		});
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<Card>
				<DetailHeader backHref="/properties" title="New Property" />
				<CardContent>
					<PropertyForm
						onSubmit={handleSubmit}
						isSubmitting={createProperty.isPending}
						submitLabel="Create Property"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
