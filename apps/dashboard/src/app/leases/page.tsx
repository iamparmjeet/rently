"use client";

import { Button } from "@rently/ui/components/button";
import { CardSkeleton } from "@rently/ui/shared/card-skelton";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { PageHeader } from "@rently/ui/shared/page-header";
import type { LeaseWithDetails } from "@rently/validators";
import { IconPlus } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { LeaseCard } from "@/components/features/leases/lease-card";
import { LeaseForm, type LeaseFormValues } from "@/components/forms/lease-form";
import { Container } from "@/components/shared/container";
import {
	useOptimisticCreateLease,
	useOptimisticTerminateLease,
	useOptimisticUpdateLease,
	useSuspenseLeases,
} from "@/hooks/leases";
import { useSuspenseProperties } from "@/hooks/properties";
import { useSuspenseTenants } from "@/hooks/tenants";
import { useSuspenseUnits } from "@/hooks/units";

type StatusFilter = "all" | "active" | "expired" | "terminated";

export default function LeasesPage() {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
	const [editingLease, setEditingLease] = useState<LeaseWithDetails | null>(
		null,
	);
	const [terminatingId, setTerminatingId] = useState<string | null>(null);

	// Dialog State
	const createDialog = useFormDialog();

	// server State
	const { data, isLoading, isError, error } = useSuspenseLeases();
	const { data: unitsData } = useSuspenseUnits();
	const { data: tenantsData } = useSuspenseTenants();
	const { data: propertiesData } = useSuspenseProperties();

	// Mutaions
	const createLease = useOptimisticCreateLease();
	const updateLease = useOptimisticUpdateLease();
	const terminateLease = useOptimisticTerminateLease();

	// Derived Data
	const availableUnits = useMemo(
		() =>
			(unitsData?.units ?? [])
				.filter((u) => u.status === "available")
				.map((u) => ({
					id: u.id,
					unitNumber: u.unitNumber,
					propertyName: u.propertyName ?? "",
					baseRent: u.baseRent,
					propertyId: u.propertyId,
				})),
		[unitsData?.units],
	);

	// For Edit - all units
	const allUnits = useMemo(
		() =>
			(unitsData?.units ?? []).map((u) => ({
				id: u.id,
				unitNumber: u.unitNumber,
				propertyId: u.propertyId,
				propertyName: u.propertyName ?? "",
				baseRent: u.baseRent,
			})),
		[unitsData?.units],
	);

	const tenants = useMemo(
		() =>
			(tenantsData?.tenants ?? []).map((t) => ({
				id: t.id,
				name: t.name,
				email: t.email,
			})),
		[tenantsData?.tenants],
	);

	const properties = useMemo(
		() =>
			(propertiesData?.properties ?? []).map((p) => ({
				id: p.id,
				name: p.name,
			})),
		[propertiesData?.properties],
	);

	// Filtered List
	const filtered = useMemo(() => {
		if (!data?.leases) return [];
		if (statusFilter === "all") return data.leases;
		return data.leases.filter((l) => l.status === statusFilter);
	}, [data?.leases, statusFilter]);

	// ********* handlers
	function handleCreate(values: LeaseFormValues) {
		createLease.mutate(
			{
				...values,
				startDate: new Date(values.startDate),
				endDate: values.endDate ? new Date(values.endDate) : undefined,
			},
			{
				onSuccess: createDialog.closeDialog,
			},
		);
	}

	function handleEdit(values: LeaseFormValues) {
		if (!editingLease) return;
		updateLease.mutate(
			{
				id: editingLease.leaseId,
				data: {
					startDate: new Date(values.startDate),
					endDate: values.endDate ? new Date(values.endDate) : undefined,
					rent: values.rent,
					deposit: values.deposit,
				},
			},
			{ onSuccess: () => setEditingLease(null) },
		);
	}

	function handleTerminateConfirm() {
		if (!terminatingId) return;
		terminateLease.mutate(
			{ id: terminatingId },
			{ onSuccess: () => setTerminatingId(null) },
		);
	}

	if (isError) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				{error.message}
			</div>
		);
	}

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				<PageHeader
					title="Leases"
					description="Manage active and past rental agreements"
				>
					<Button aria-label="new lease" onClick={createDialog.openDialog}>
						<IconPlus className="mr-2 size-4" />
						New Lease
					</Button>
					<FormDialog
						open={createDialog.open}
						onOpenChange={createDialog.onOpenChange}
						title="New Lease"
						description="Create a rental agreement between a unit and a tenant."
						formId="create-lease-form"
						isSubmitting={createLease.isPending}
						submitLabel="Create Lease"
					>
						<LeaseForm
							key={createDialog.open ? "open" : "closed"}
							units={availableUnits}
							tenants={tenants}
							properties={properties}
							formId="create-lease-form"
							onSubmit={handleCreate}
							isSubmitting={createLease.isPending}
						/>
					</FormDialog>
				</PageHeader>

				{/* ── Status filter tabs ────────────── */}
				<div className="flex gap-2">
					{(["all", "active", "expired", "terminated"] as const).map((s) => (
						<Button
							key={s}
							variant={statusFilter === s ? "default" : "outline"}
							size="sm"
							onClick={() => setStatusFilter(s)}
							className="capitalize"
						>
							{s}
						</Button>
					))}
				</div>
				{/* ── Lease grid ──────────────────────────────────────────────── */}
				{isLoading ? (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{Array.from({ length: 6 }).map((_, i) => (
							<CardSkeleton key={i} />
						))}
					</div>
				) : filtered.length === 0 ? (
					<div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed bg-white py-16 text-center">
						<p className="text-muted-foreground">
							{data?.leases?.length === 0
								? "No leases yet. Create your first one!"
								: "No leases match this filter."}
						</p>
						{data?.leases?.length === 0 && (
							<Button className="mt-4" onClick={createDialog.openDialog}>
								<IconPlus className="mr-2 size-4" />
								New Lease
							</Button>
						)}
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
						{filtered.map((lease) => (
							<LeaseCard
								key={lease.leaseId}
								lease={lease}
								onEdit={setEditingLease}
								onDelete={(id) => setTerminatingId(id)}
								isDeleting={
									terminateLease.isPending &&
									terminateLease.variables?.id === lease.leaseId
								}
								createdAt={lease.createdAt}
								updatedAt={lease.updatedAt}
							/>
						))}
					</div>
				)}

				{/* ── Edit Lease Dialog (one instance, controlled by editingLease) ── */}
				{/* WHY: Render outside the list loop — one dialog instance is
                cheaper than N instances. Controlled by editingLease state. */}
				<FormDialog
					open={editingLease !== null}
					onOpenChange={(open) => {
						if (!open) setEditingLease(null);
					}}
					title="Edit Lease"
					description="Update dates, rent, deposit, and status. Unit and tenant cannot be changed."
					formId="edit-lease-form"
					isSubmitting={updateLease.isPending}
					submitLabel="Save Changes"
				>
					{editingLease && (
						<LeaseForm
							key={editingLease.leaseId}
							// propertyId={properties}
							units={allUnits}
							tenants={tenants}
							properties={properties}
							formId="edit-lease-form"
							defaultValues={{
								unitId: editingLease.unitId,
								tenantId: editingLease.tenantId,
								startDate: new Date(editingLease.startDate)
									.toISOString()
									.split("T")[0],
								endDate: editingLease.endDate
									? new Date(editingLease.endDate).toISOString().split("T")[0]
									: undefined,
								rent: editingLease.rent,
								deposit: editingLease.deposit ?? undefined,
								// status: editingLease.status,
							}}
							onSubmit={handleEdit}
							isSubmitting={updateLease.isPending}
						/>
					)}
				</FormDialog>

				{/* ── Terminate Confirm Dialog ─────────────────────────────────── */}
				<ConfirmDialog
					open={terminatingId !== null}
					onOpenChange={(open) => {
						if (!open) setTerminatingId(null);
					}}
					title="Terminate Lease?"
					description="This will set the lease status to Terminated and free up the unit. Past payments and utility records are preserved."
					confirmLabel="Terminate"
					destructive
					onConfirm={handleTerminateConfirm}
					isLoading={terminateLease.isPending}
				/>
			</div>
		</Container>
	);
}
