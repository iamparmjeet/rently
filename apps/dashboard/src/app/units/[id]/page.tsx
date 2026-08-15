// apps/web/src/app/(dashboard)/units/[id]/page.tsx
"use client";

import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageLoader } from "@rently/ui/shared/page-loader";
import type { CreateUnit, UpdateUnit } from "@rently/validators";
import {
	IconAlertCircle,
	IconBuildingStore,
	IconCalendar,
	IconChevronLeft,
	IconHome,
	IconLayout,
	IconPencil,
	IconRuler,
	IconTrash,
	IconUser,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { AddLeaseButton } from "@/components/features/leases/add-lease-button";
import { UnitForm } from "@/components/forms/unit-form";
import { Container } from "@/components/shared/container";
import {
	useOptimisticDeleteUnit,
	useOptimisticUpdateUnit,
	useSuspenseUnit,
} from "@/hooks/units";

export default function UnitDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();

	const { data, isLoading } = useSuspenseUnit(id);
	const editDialog = useFormDialog();
	const deleteDialog = useFormDialog();

	const updateUnit = useOptimisticUpdateUnit();
	const deleteUnit = useOptimisticDeleteUnit();

	if (isLoading) return <PageLoader rows={2} />;
	if (!data?.unit) return <NotFoundState message="Unit not found." />;

	const { unit } = data;
	const isOccupied = unit.status === "occupied";
	const activeLease = unit.activeLease;

	function handleEditSubmit(values: UpdateUnit) {
		updateUnit.mutate(
			{ id: unit.id, data: values },
			{ onSuccess: editDialog.closeDialog },
		);
	}

	function handleDelete() {
		deleteUnit.mutate(
			{ id: unit.id },
			{
				onSuccess: () => {
					deleteDialog.closeDialog();
					router.push(`/properties/${unit.propertyId}`);
				},
				onError: deleteDialog.closeDialog,
			},
		);
	}

	return (
		<Container>
			<div className="col-span-12 space-y-6">
				<div className="flex items-center justify-between gap-4">
					<Button
						variant="ghost"
						nativeButton={false}
						className="-ml-2 text-muted-foreground"
						render={<Link href={`/properties/${unit.propertyId}` as Route} />}
					>
						<IconChevronLeft className="size-4" />
						{unit.propertyName ?? "Property"}
					</Button>
					<div className="flex items-center gap-2">
						<Button onClick={editDialog.openDialog} variant="outline">
							<IconPencil className="size-4" />
							Edit
						</Button>
						<FormDialog
							open={editDialog.open}
							onOpenChange={editDialog.onOpenChange}
							title={`Edit Unit : ${unit.unitNumber}`}
							description="Update the Unit details."
							formId="update-unit-form"
							isSubmitting={updateUnit.isPending}
							submitLabel="Update Unit"
						>
							<UnitForm
								key={editDialog.open ? "open" : "closed"}
								propertyId={unit.propertyId ?? ""}
								defaultValues={{
									unitNumber: unit.unitNumber,
									baseRent: unit.baseRent,
									area: unit.area,
									description: unit.description,
									furnishing: getInitialFurnishing(unit.furnishing),
									type: unit.type,
								}}
								formId="update-unit-form"
								onSubmit={handleEditSubmit}
								isSubmitting={updateUnit.isPending}
							/>
						</FormDialog>
						<Button
							variant="destructive"
							onClick={deleteDialog.openDialog}
							disabled={isOccupied}
							title={
								isOccupied
									? "End the active lease before deleting this unit"
									: undefined
							}
						>
							<IconTrash className="mr-2 size-4" /> Delete Unit
						</Button>
						<ConfirmDialog
							open={deleteDialog.open}
							onOpenChange={deleteDialog.onOpenChange}
							title="Delete Unit"
							description="This will permanently delete the unit and all its lease. This action cannot be undone."
							confirmLabel="Delete"
							destructive
							onConfirm={handleDelete}
							isLoading={deleteUnit.isPending}
						/>
					</div>
				</div>

				<Card className="overflow-hidden border-primary/15 py-0 shadow-sm">
					<CardHeader className="border-b bg-gradient-to-br from-primary/[0.10] via-primary/[0.025] to-transparent px-5 pt-6 pb-5 sm:px-7">
						<div className="flex flex-wrap items-start justify-between gap-4">
							<div className="flex items-start gap-3">
								<div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
									{unit.type === "studio" ? (
										<IconHome className="size-5" />
									) : (
										<IconBuildingStore className="size-5" />
									)}
								</div>
								<div>
									<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
										{formatUnitType(unit.type)}
									</p>
									<h1 className="mt-1 font-semibold text-2xl tracking-tight">
										Unit {unit.unitNumber}
									</h1>
									<p className="mt-1 text-muted-foreground text-sm">
										{unit.propertyName}
									</p>
								</div>
							</div>
							<div className="rounded-lg border border-primary/15 bg-background/70 px-4 py-3">
								<p className="font-semibold text-xl">
									₹{unit.baseRent.toLocaleString("en-IN")}
									<span className="ml-1 font-normal text-muted-foreground text-xs">
										/mo
									</span>
								</p>
								<Badge
									variant="outline"
									className={
										isOccupied
											? "mt-2 rounded-full border-emerald-200 bg-emerald-50 text-emerald-700"
											: "mt-2 rounded-full border-amber-200 bg-amber-50 text-amber-700"
									}
								>
									{isOccupied ? "Occupied" : "Available"}
								</Badge>
							</div>
						</div>
					</CardHeader>
					<CardContent className="space-y-5 px-5 py-5 sm:px-7">
						<div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
							<UnitStat label="Type" value={formatUnitType(unit.type)} />
							<UnitStat
								label="Base rent"
								value={`₹${unit.baseRent.toLocaleString("en-IN")}/mo`}
							/>
							<UnitStat
								label="Area"
								value={
									unit.area ? (
										<span className="flex items-center gap-1.5">
											<IconRuler className="size-3.5 text-muted-foreground" />
											{unit.area.toLocaleString("en-IN")} sq ft
										</span>
									) : (
										"Not recorded"
									)
								}
							/>
							<UnitStat
								label="Furnishing"
								value={formatFurnishing(unit.furnishing)}
							/>
						</div>
						{unit.description && (
							<div className="border-t pt-4">
								<p className="text-muted-foreground text-xs">Notes</p>
								<p className="mt-1 text-sm leading-6">{unit.description}</p>
							</div>
						)}
					</CardContent>
				</Card>

				<Card
					className={activeLease ? "border-primary/20 shadow-sm" : "shadow-sm"}
				>
					<CardHeader className="flex flex-row items-center justify-between gap-4">
						<div>
							<CardTitle className="text-base">Current tenancy</CardTitle>
							<p className="mt-1 text-muted-foreground text-sm">
								{activeLease
									? "The tenant and agreement currently assigned to this unit."
									: "This unit is ready to be assigned to a tenant."}
							</p>
						</div>
						{activeLease && (
							<Badge variant="default" className="capitalize">
								{activeLease.status}
							</Badge>
						)}
					</CardHeader>
					<CardContent>
						{activeLease ? (
							<div className="space-y-5">
								<div className="flex flex-wrap items-center justify-between gap-4">
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary/10">
											<IconUser className="size-5 text-primary" />
										</div>
										<div className="min-w-0">
											<p className="truncate font-semibold">
												{activeLease.tenantName ?? "Tenant name unavailable"}
											</p>
											<p className="truncate text-muted-foreground text-sm">
												{activeLease.tenantEmail ?? "Email unavailable"}
											</p>
										</div>
									</div>
									<Button
										nativeButton={false}
										variant="outline"
										render={
											<Link href={`/leases/${activeLease.id}` as Route} />
										}
									>
										Open lease
									</Button>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<UnitStat
										label="Lease rent"
										value={`₹${activeLease.rent.toLocaleString("en-IN")}/mo`}
									/>
									<UnitStat
										label="Started"
										value={
											<span className="flex items-center gap-1.5">
												<IconCalendar className="size-3.5 text-muted-foreground" />
												{formatDate(activeLease.startDate)}
											</span>
										}
									/>
								</div>
							</div>
						) : isOccupied ? (
							<div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-6 text-center dark:border-amber-900 dark:bg-amber-950">
								<IconAlertCircle className="mx-auto mb-2 size-6 text-amber-600" />
								<p className="font-medium text-amber-800 text-sm dark:text-amber-200">
									Data Inconsistency Detected
								</p>
								<p className="text-amber-700 text-xs dark:text-amber-300">
									Unit status is "occupied" but no active lease found.
								</p>

								<Button
									nativeButton={false}
									variant="outline"
									size="sm"
									className="mt-3"
									render={<Link href="/leases/new" />}
									aria-label="Create Lease"
								>
									Create Lease
								</Button>
							</div>
						) : (
							<NoLease id={id} />
						)}
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}

function UnitStat({ label, value }: { label: string; value: React.ReactNode }) {
	return (
		<div className="rounded-lg border bg-muted/30 px-3 py-3">
			<p className="text-muted-foreground text-xs">{label}</p>
			<div className="mt-1.5 font-semibold text-sm">{value}</div>
		</div>
	);
}

function formatUnitType(type: string) {
	return type === "studio" ? "Studio" : type === "shop" ? "Shop" : type;
}

function formatFurnishing(furnishing: string | null) {
	if (!furnishing) return "Not recorded";
	return furnishing
		.replaceAll("_", " ")
		.replace(/^./, (value) => value.toUpperCase());
}

function getInitialFurnishing(value: string | null): CreateUnit["furnishing"] {
	if (
		value === "unfurnished" ||
		value === "semi_furnished" ||
		value === "fully_furnished"
	) {
		return value;
	}

	return "unfurnished";
}

function formatDate(date: Date) {
	return new Intl.DateTimeFormat("en-IN", {
		day: "numeric",
		month: "short",
		year: "numeric",
	}).format(date);
}

function NoLease({ id }: { id: string }) {
	return (
		<EmptyState
			icon={IconLayout}
			title="No Lease yet"
			description="Add your first lease to start tracking tenants and rent."
			className="rounded-xl border border-dashed bg-muted/20"
		>
			<AddLeaseButton unitId={id} withIcon />
		</EmptyState>
	);
}
