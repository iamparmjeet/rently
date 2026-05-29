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
import { DateRecordMeta } from "@/components/shared/date-record-meta";
import { NotFoundState } from "@/components/shared/not-found-state";
import { PageLoader } from "@/components/shared/page-loader";
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

	if (isLoading) return <PageLoader />;

	if (!data?.property) return <NotFoundState message="Property not found." />;

	const { property } = data;
	// console.log(data);

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

			{/*{JSON.stringify(data)}*/}
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
					<DateRecordMeta
						className="mt-4"
						createdAt={property.createdAt}
						updatedAt={property.updatedAt}
					/>
				</CardContent>
			</Card>
		</div>
	);
}
