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
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { UnitForm, type UnitFormValues } from "@/components/forms/unit-form";
import { useCreateUnit } from "@/hooks/units";

function NewUnitContent() {
	const router = useRouter();
	const searchParams = useSearchParams();

	// propertyId comes from /properties/[id]
	const propertyId = searchParams.get("propertyId") ?? "";

	const createNewUnit = useCreateUnit();

	function handleSubmit(values: UnitFormValues) {
		createNewUnit.mutate(values, {
			onSuccess: () => {
				// Go back to property detail if we came from there, else units list
				const returnTo = propertyId ? `/properties/${propertyId}` : "/units";
				router.push(returnTo);
			},
		});
	}

	if (!propertyId) {
		return (
			<div className="col-span-12 mx-auto w-full max-w-lg">
				<div className="rounded-xl border border-dashed py-16 text-center">
					<p className="text-muted-foreground">
						A property must be selected before adding a unit.
					</p>
					<Button className="mt-4">
						<Link href="/properties">Go to Properties</Link>
					</Button>
				</div>
			</div>
		);
	}

	return (
		<div className="col-span-12 mx-auto w-full max-w-lg">
			<div className="mb-4 flex items-center gap-2">
				<Button variant="ghost" size="icon">
					<Link href={propertyId ? `/properties/${propertyId}` : "/units"}>
						<IconArrowLeft className="size-4" />
					</Link>
				</Button>
				<h1 className="font-semibold text-xl">Add New Unit</h1>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>New Unit</CardTitle>
					<CardDescription>
						Add a new unit to start managing tenants.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<UnitForm
						propertyId={propertyId}
						onSubmit={handleSubmit}
						isSubmitting={createNewUnit.isPending}
						submitLabel="Create Unit"
					/>
				</CardContent>
			</Card>
		</div>
	);
}

export default function NewUnitPage() {
	return (
		<Suspense
			fallback={
				<div className="col-span-12 h-96 animate-pulse rounded-xl bg-muted" />
			}
		>
			<NewUnitContent />
		</Suspense>
	);
}
