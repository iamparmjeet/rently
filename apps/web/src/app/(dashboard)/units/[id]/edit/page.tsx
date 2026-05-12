// apps/web/src/app/(dashboard)/units/[id]/edit/page.tsx

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
import { UnitForm, type UnitFormValues } from "@/components/forms/unit-form";
import { useUnit, useUpdateUnit } from "@/hooks/units";

export default function EditUnitPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const { data, isLoading } = useUnit(id);
	const updateUnit = useUpdateUnit();

	if (isLoading) {
		return (
			<div className="col-span-12 mx-auto w-full max-w-lg space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-96 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	if (!data?.unit) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				Unit not found.
			</div>
		);
	}

	const { unit } = data;

	function handleSubmit(values: UnitFormValues) {
		// UpdateUnit takes { id, data } — map form values to that shape
		updateUnit.mutate(
			{
				id,
				data: {
					unitNumber: values.unitNumber,
					type: values.type,
					baseRent: values.baseRent,
					area: values.area,
					description: values.description,
				},
			},
			{
				onSuccess: () => router.push(`/units/${id}`),
			},
		);
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<div className="mb-4 flex items-center gap-2">
				<Button variant="ghost" size="icon">
					<Link href={`/units/${id}`}>
						<IconArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold text-xl">Edit Unit {unit.unitNumber}</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Edit Unit Details</CardTitle>
					<CardDescription>
						Changes will take effect immediately.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<UnitForm
						propertyId={unit.propertyId}
						defaultValues={{
							unitNumber: unit.unitNumber,
							type: unit.type,
							baseRent: unit.baseRent,
							area: unit.area,
							description: unit.description,
						}}
						onSubmit={handleSubmit}
						isSubmitting={updateUnit.isPending}
						submitLabel="Save Changes"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
