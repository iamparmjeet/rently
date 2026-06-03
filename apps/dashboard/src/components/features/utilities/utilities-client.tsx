// apps/web/src/app/(dashboard)/utilities/_components/utilities-client.tsx
"use client";

import {
	FIXEDCHARGE,
	type PaymentStatus,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import {
	Table,
	TableBody,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { paiseToFormValue, toPaise } from "@rently/ui/lib/currency";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { PageHeader } from "@rently/ui/shared/page-header";
import type {
	UtilityBatchFormValues,
	UtilityListItem,
} from "@rently/validators";
import { IconBolt, IconPlus } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { UtilityForm } from "@/components/forms/utility-form";
import { Container } from "@/components/shared/container";
import { useSuspenseLeases } from "@/hooks/leases";
import {
	useOptimisticCreateBatchUtility,
	useOptimisticRemoveUtility,
	useOptimisticUpdateUtility,
	useSuspenseUtilities,
} from "@/hooks/utilities";
import type { client } from "@/utils/orpc";
import { LeasePickerThenForm } from "./lease-picker-form";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { StatCard } from "./stat-card";
import { UtilityDetailSheet } from "./utility-detail-sheet";
import { UtilityTableRow } from "./utility-table-row";

type UtilityFilters = {
	search: string;
	isPaid: "all" | PaymentStatus;
};

type BatchItem = Parameters<
	typeof client.rent.utility.createUtilityBatch
>[0]["items"][number];

export default function UtilitiesClient() {
	const { data } = useSuspenseUtilities();
	const { data: leasesData } = useSuspenseLeases();

	const createBatch = useOptimisticCreateBatchUtility();
	const updateUtility = useOptimisticUpdateUtility();
	const removeUtility = useOptimisticRemoveUtility();

	const [filters, setFilters] = useState<UtilityFilters>({
		search: "",
		isPaid: "all",
	});
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<UtilityListItem | null>(null);
	const [detailTarget, setDetailTarget] = useState<UtilityListItem | null>(
		null,
	);
	const [markPaidTarget, setMarkPaidTarget] = useState<UtilityListItem | null>(
		null,
	);

	// derived data
	// Client-side filter on cached data — no network cost.
	// The backend already filtered by ownerId — we only filter the display here.
	const filteredUtilities = useMemo(() => {
		const list = data?.utilities ?? [];
		return list.filter((u) => {
			if (filters.search) {
				const q = filters.search.toLowerCase();
				if (
					!u.unitNumber.toLowerCase().includes(q) &&
					!u.propertyName.toLowerCase().includes(q) &&
					!(u.tenantName ?? "").toLowerCase().includes(q)
				)
					return false;
			}
			if (filters.isPaid === "paid" && !u.isPaid) return false;
			if (filters.isPaid === "unpaid" && u.isPaid) return false;
			return true;
		});
	}, [data?.utilities, filters]);

	// Stats derived from server data — no separate API call needed
	const stats = useMemo(() => {
		const all = data?.utilities ?? [];
		const unpaidEntries = all.filter((u) => !u.isPaid);
		const unpaidTotal = unpaidEntries.reduce(
			(sum, u) => sum + u.totalAmount,
			0,
		);
		return {
			total: all.length,
			unpaidCount: unpaidEntries.length,
			// totalAmount is in paise — divide by 100 for rupee display
			unpaidRupees: (unpaidTotal / 100).toFixed(2),
		};
	}, [data?.utilities]);

	// Active leases for the create form's lease selector
	const activeLeases = useMemo(
		() =>
			leasesData?.leases
				?.filter((l) => l.status === "active")

				.map((l) => ({
					id: l.leaseId,
					unitId: l.unitId,
					unitNumber: l.unitNumber,
					tenantName: l.tenantName,
				})) ?? [],
		[leasesData?.leases],
	);

	// Handlers
	function handleCreate(values: UtilityBatchFormValues) {
		const items: BatchItem[] = [];
		const sharedDates = {
			leaseId: values.leaseId,
			batchId: values.batchId ?? null,
			previousReadingDate: new Date(values.previousReadingDate),
			currentReadingDate: new Date(values.currentReadingDate),
			// WHY readingDate = currentReadingDate: the "reading date" is when
			// the meter was last read — i.e. the end of the billing period.
			readingDate: new Date(values.currentReadingDate),
		};

		if (values.electricity) {
			items.push({
				...sharedDates,
				utilityType: "electricity",
				previousReading: values.electricity.previousReading,
				currentReading: values.electricity.currentReading,
				ratePerUnit: toPaise(values.electricity.ratePerUnit),
				fixedCharge: toPaise(values.electricity.fixedCharge),
				description: null,
			});
		}

		if (values.water) {
			items.push({
				...sharedDates,
				utilityType: "water",
				// WHY 0 for readings: fixed mode has no meter. unitsUsed = 0.
				// Server computes totalAmount = 0 * 0 + fixedCharge = fixedCharge.
				previousReading: 0,
				currentReading: 0,
				ratePerUnit: 0,
				fixedCharge: toPaise(values.water.fixedCharge),
				description: values.water.description ?? null,
			});
		}

		if (values.maintenance) {
			items.push({
				...sharedDates,
				utilityType: "maintenance",
				previousReading: 0,
				currentReading: 0,
				ratePerUnit: 0,
				fixedCharge: toPaise(values.maintenance.fixedCharge),
				description: values.maintenance.description ?? null,
			});
		}

		createBatch.mutate(
			{ leaseId: values.leaseId, batchId: values.batchId, items },
			{ onSuccess: () => setCreateOpen(false) },
		);
	}

	function handleUpdate(values: UtilityBatchFormValues) {
		if (!editTarget) return;

		// Extract only the section matching the row being edited,
		// convert rupees → paise for monetary fields.
		const sharedDates = {
			previousReadingDate: new Date(values.previousReadingDate),
			currentReadingDate: new Date(values.currentReadingDate),
		};

		let updateData = {};
		if (editTarget.utilityType === "electricity" && values.electricity) {
			updateData = {
				...sharedDates,
				previousReading: values.electricity.previousReading,
				currentReading: values.electricity.currentReading,
				ratePerUnit: toPaise(values.electricity.ratePerUnit),
				fixedCharge: toPaise(values.electricity.fixedCharge),
			};
		} else if (editTarget.utilityType === "water" && values.water) {
			updateData = {
				...sharedDates,
				fixedCharge: toPaise(values.water.fixedCharge),
				// description: values.water.description ?? null,
			};
		} else if (editTarget.utilityType === "maintenance" && values.maintenance) {
			updateData = {
				...sharedDates,
				fixedCharge: toPaise(values.maintenance.fixedCharge),
				description: values.maintenance.description ?? null,
			};
		}

		updateUtility.mutate(
			{ id: editTarget.id, data: updateData },
			{ onSuccess: () => setEditTarget(null) },
		);
	}

	const batchItems = useMemo(() => {
		// ← always UtilityListItem[], inferred automatically
		if (!detailTarget) return [];
		if (!detailTarget.batchId) return [detailTarget];
		return data.utilities.filter((u) => u.batchId === detailTarget.batchId);
	}, [data.utilities, detailTarget]);

	return (
		<Container>
			<div className="col-span-12 flex min-h-screen flex-col gap-6">
				{/* Page Header */}
				<PageHeader
					title="Utilities"
					description="Track meter readings and electricity billing"
				>
					<Dialog open={createOpen} onOpenChange={setCreateOpen}>
						<DialogTrigger
							render={
								<Button onClick={() => setCreateOpen(true)}>
									<IconPlus className="size-4" />
									New Reading
								</Button>
							}
						/>
						<DialogContent className="max-w-md">
							<DialogHeader>
								<DialogTitle>Record Utility Reading</DialogTitle>
							</DialogHeader>
							{/* WHY: We require the owner to pick a lease first before opening the form.
						    The leaseId is required — it's how we enforce ownership on the backend. */}
							<LeasePickerThenForm
								leases={activeLeases}
								onSubmit={handleCreate}
								isSubmitting={createBatch.isPending}
							/>
						</DialogContent>
					</Dialog>
				</PageHeader>

				{/* Stats */}
				<div className="grid grid-cols-3 gap-4">
					<StatCard label="Total Readings" value={String(stats.total)} />
					<StatCard
						label="Unpaid Readings"
						value={String(stats.unpaidCount)}
						highlight={stats.unpaidCount > 0}
					/>
					<StatCard
						label="Total Unpaid"
						value={`₹${stats.unpaidRupees}`}
						highlight={stats.unpaidCount > 0}
					/>
				</div>

				{/* Filters */}
				<div className="flex gap-3">
					<Input
						placeholder="Search by unit, property, tenant..."
						value={filters.search}
						onChange={(e) =>
							setFilters((f) => ({ ...f, search: e.target.value }))
						}
						className="max-w-xs"
					/>
					<Select
						value={filters.isPaid}
						onValueChange={(v) =>
							setFilters((f) => ({
								...f,
								isPaid: v as UtilityFilters["isPaid"],
							}))
						}
					>
						<SelectTrigger className="w-36">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All</SelectItem>
							<SelectItem value="paid">Paid</SelectItem>
							<SelectItem value="unpaid">Unpaid</SelectItem>
						</SelectContent>
					</Select>
				</div>

				{/* Table */}
				{filteredUtilities.length === 0 ? (
					<EmptyState
						className="rounded-md bg-white"
						icon={IconBolt}
						title="No utility readings"
						description="Record your first meter reading to get started."
					/>
				) : (
					<div className="rounded-md border">
						<Table className="rounded-md bg-white font-large">
							<TableHeader>
								<TableRow>
									<TableHead>Unit / Property</TableHead>
									<TableHead>Tenant</TableHead>
									<TableHead>Date</TableHead>
									<TableHead>Type</TableHead>
									<TableHead className="text-right">Units Used</TableHead>
									<TableHead className="text-right">Total (₹)</TableHead>
									<TableHead>Status</TableHead>
									<TableHead className="text-right">Actions</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{filteredUtilities.map((u) => (
									<UtilityTableRow
										key={u.id}
										utility={u}
										onViewDetail={() => setDetailTarget(u)}
										onEdit={() => setEditTarget(u)}
										onDelete={() => removeUtility.mutate({ id: u.id })}
										onMarkPaid={() => setMarkPaidTarget(u)}
										isDeleting={
											removeUtility.isPending &&
											removeUtility.variables?.id === u.id
										}
									/>
								))}
							</TableBody>
						</Table>
					</div>
				)}

				{/* Edit Dialog */}
				<Dialog
					open={!!editTarget}
					onOpenChange={(o) => !o && setEditTarget(null)}
				>
					<DialogContent className="max-w-md">
						<DialogHeader>
							<DialogTitle>Edit Meter Reading</DialogTitle>
						</DialogHeader>
						{editTarget && (
							<UtilityForm
								leaseId={editTarget.leaseId}
								defaultValues={mapUtilityToFormDefaults(editTarget)}
								onSubmit={handleUpdate}
								isSubmitting={updateUtility.isPending}
								submitLabel="Update Reading"
							/>
						)}
					</DialogContent>
				</Dialog>

				{/* Detail Sheet */}
				<UtilityDetailSheet
					items={batchItems}
					open={detailTarget !== null}
					onOpenChange={(o) => !o && setDetailTarget(null)}
					onMarkPaid={setMarkPaidTarget}
				/>

				{/* Mark Paid Dialog */}
				<MarkPaidDialog
					utility={markPaidTarget}
					open={markPaidTarget !== null}
					onOpenChange={(o) => !o && setMarkPaidTarget(null)}
				/>
			</div>
		</Container>
	);
}

function mapUtilityToFormDefaults(
	u: UtilityListItem,
): Partial<UtilityBatchFormValues> {
	const base = {
		leaseId: u.leaseId,
		previousReadingDate: u.previousReadingDate
			? new Date(u.previousReadingDate).toISOString().split("T")[0]
			: new Date().toISOString().split("T")[0],
		currentReadingDate: u.currentReadingDate
			? new Date(u.currentReadingDate).toISOString().split("T")[0]
			: new Date(u.currentReadingDate).toISOString().split("T")[0],
	};

	if (u.utilityType === "electricity") {
		return {
			...base,
			electricity: {
				previousReading: Number(u.previousReading),
				currentReading: Number(u.currentReading),
				// WHY paiseToFormValue: the DB stores paise; the form expects rupees
				ratePerUnit: paiseToFormValue(u.ratePerUnit ?? RATEPERUNIT),
				fixedCharge: paiseToFormValue(u.fixedCharge ?? FIXEDCHARGE),
				isPaid: u.isPaid,
			},
		};
	}

	return {
		...base,
		[u.utilityType]: {
			fixedCharge: paiseToFormValue(u.fixedCharge ?? 0),
			description: u.description ?? undefined,
			isPaid: u.isPaid,
		},
	};
}
