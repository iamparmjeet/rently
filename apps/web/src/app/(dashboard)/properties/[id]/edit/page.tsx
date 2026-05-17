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
	PropertyForm,
	type PropertyFormValues,
} from "@/components/forms/property-form";
import { useProperty, useUpdateProperty } from "@/hooks/properties";

export default function EditPropertyPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();
	const { data, isLoading } = useProperty(id);
	const updateProperty = useUpdateProperty();

	if (isLoading) {
		return (
			<div className="col-span-12 mx-auto w-full max-w-lg space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-64 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	if (!data?.property) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				Property not found.
			</div>
		);
	}

	const { property } = data;

	function handleSubmit(values: PropertyFormValues) {
		updateProperty.mutate(
			{ id, data: values },
			{ onSuccess: () => router.push(`/properties/${id}`) },
		);
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<div className="mb-4 flex items-center gap-2">
				<Button variant="ghost" size="icon">
					<Link href={`/properties/${id}`}>
						<IconArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold text-xl">Edit {property.name}</h1>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Edit Property</CardTitle>
					<CardDescription>Update your property details below.</CardDescription>
				</CardHeader>
				<CardContent>
					<PropertyForm
						defaultValues={{
							name: property.name,
							address: property.address,
							type: property.type,
						}}
						onSubmit={handleSubmit}
						isSubmitting={updateProperty.isPending}
						submitLabel="Save Changes"
					/>
				</CardContent>
			</Card>
		</div>
	);
}
