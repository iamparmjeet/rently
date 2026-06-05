"use client";

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { DetailHeader } from "@rently/ui/shared/detail-header";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
// import { PageLoader } from "@rently/ui/shared/page-loader";
import { IconPencil, IconTrash } from "@tabler/icons-react";

import { use, useMemo } from "react";
import { LeaseDetails } from "@/components/features/leases/lease-details";
import LeaseStatusBadge from "@/components/features/leases/lease-status-badge";
import { LeaseForm, type LeaseFormValues } from "@/components/forms/lease-form";
import { Container } from "@/components/shared/container";
import {
	useOptimisticUpdateLease,
	useSuspenseLease,
	useTerminateLease,
} from "@/hooks/leases";
import { useSuspenseProperties } from "@/hooks/properties";
import { useSuspenseTenants } from "@/hooks/tenants";
import { useSuspenseUnits } from "@/hooks/units";

export default function LeaseDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);

	// Dialog
	const editDialog = useFormDialog();
	const terminateDialog = useFormDialog();

	// server state
	const { data } = useSuspenseLease(id);
	const { data: unitsData } = useSuspenseUnits();
	const { data: tenantsData } = useSuspenseTenants();
	const { data: propertiesData } = useSuspenseProperties();

	// Mutaions
	const updateLease = useOptimisticUpdateLease();
	const terminateLease = useTerminateLease();

	const allUnits = useMemo(
		() =>
			(unitsData?.units ?? []).map((u) => ({
				id: u.id,
				unitNumber: u.unitNumber,
				propertyName: u.propertyName ?? "",
				baseRent: u.baseRent,
				propertyId: u.propertyId,
				type: u.type,
				area: u.area,
				furnishing: u.furnishing,
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

	// isLoading always false in suspense
	// if (isLoading) return <PageLoader rows={2} />;
	if (!data?.lease) return <NotFoundState message="Lease not found." />;

	const { lease } = data;
	const isTerminated = lease.status === "terminated";

	// Handlers
	function handleEdit(values: LeaseFormValues) {
		updateLease.mutate(
			{
				id,
				data: {
					startDate: new Date(values.startDate),
					endDate: values.endDate ? new Date(values.endDate) : undefined,
					rent: values.rent,
					deposit: values.deposit,
				},
			},
			{ onSuccess: editDialog.closeDialog },
		);
	}
	function handleTerminate() {
		terminateLease.mutate({ id }, { onSuccess: terminateDialog.closeDialog });
	}

	return (
		<Container>
			<div className="col-span-12 space-y-6">
				{/*Header*/}
				<DetailHeader
					backHref="/leases"
					title="Lease Details"
					subtitle={`ID: ${id}`}
				>
					<Button
						variant="outline"
						disabled={isTerminated}
						onClick={editDialog.openDialog}
					>
						<IconPencil className="mr-2 size-4" />
						Edit
					</Button>
					<Button
						variant="destructive"
						onClick={terminateDialog.openDialog}
						disabled={terminateLease.isPending || isTerminated}
					>
						<IconTrash className="mr-2 size-4" />
						Terminate
					</Button>
				</DetailHeader>
				{/*Main Details*/}
				<LeaseDetails lease={lease} />

				<Card>
					<CardHeader>
						<div className="flex items-center justify-between">
							<CardTitle className="text-base">Agreement</CardTitle>
							<LeaseStatusBadge status={lease.status} />
						</div>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
						<div>
							<p className="text-muted-foreground text-xs">Monthly Rent</p>
							<p className="font-semibold text-2xl">
								₹{lease.rent.toLocaleString("en-IN")}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Deposit</p>
							<p className="font-semibold text-2xl">
								{lease.deposit
									? `₹${lease.deposit.toLocaleString("en-IN")}`
									: "—"}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Start Date</p>
							<p className="font-semibold">
								{new Date(lease.startDate).toLocaleDateString("en-IN")}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">End Date</p>
							<p className="font-semibold">
								{lease.endDate
									? new Date(lease.endDate).toLocaleDateString("en-IN")
									: "Ongoing"}
							</p>
						</div>
					</CardContent>
				</Card>

				{/* TODO: Payments + Utilities stubs — implement in next session */}
				{/* Payments stub */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Payments</CardTitle>
					</CardHeader>
					<CardContent className="py-8 text-center text-muted-foreground text-sm">
						Payment history — coming soon
					</CardContent>
				</Card>

				{/* TODO: Utilities stub */}
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Utility Readings</CardTitle>
					</CardHeader>
					<CardContent className="py-8 text-center text-muted-foreground text-sm">
						Utility readings — coming soon
					</CardContent>
				</Card>
				<FormDialog
					open={editDialog.open}
					onOpenChange={editDialog.onOpenChange}
					title="Edit Lease"
					description="Update dates, rent, and deposit. Unit and tenant cannot be changed."
					formId="edit-lease-form"
					isSubmitting={updateLease.isPending}
					submitLabel="Save Changes"
				>
					<LeaseForm
						key={editDialog.open ? "open" : "closed"}
						formId="edit-lease-form"
						units={allUnits}
						tenants={tenants}
						properties={properties}
						defaultValues={{
							unitId: lease.unitId,
							tenantId: lease.tenantId,
							startDate: new Date(lease.startDate).toISOString().split("T")[0],
							endDate: lease.endDate
								? new Date(lease.endDate).toISOString().split("T")[0]
								: undefined,
							rent: lease.rent,
							deposit: lease.deposit ?? undefined,
						}}
						onSubmit={handleEdit}
						isSubmitting={updateLease.isPending}
					/>
				</FormDialog>

				{/* ── Terminate Dialog ─────────────────────────────────── */}
				<ConfirmDialog
					open={terminateDialog.open}
					onOpenChange={terminateDialog.onOpenChange}
					title="Terminate Lease?"
					description="This will set the lease status to Terminated and free up the unit. Past payments and utility records are preserved."
					confirmLabel="Terminate"
					destructive
					onConfirm={handleTerminate}
					isLoading={terminateLease.isPending}
				/>
			</div>
		</Container>
	);
}
