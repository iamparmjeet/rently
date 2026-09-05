"use client";

import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";

import {
	formatRupees,
	paiseToFormValue,
	toPaise,
} from "@rently/ui/lib/currency";
import { FormDialog, useFormDialog } from "@rently/ui/shared/form-dialog";
import { PageHeader } from "@rently/ui/shared/page-header";
import type {
	UtilityBatchFormValues,
	UtilityListItem,
} from "@rently/validators";
import {
	IconAlertTriangle,
	IconBolt,
	IconDownload,
	IconDroplet,
	IconFileInvoice,
	IconLayoutGrid,
	IconList,
	IconPlus,
	IconReceipt,
	IconSearch,
	IconTool,
} from "@tabler/icons-react";
import { useMemo, useRef, useState } from "react";
import { UtilityForm } from "@/components/forms/utility-form";
import { Container } from "@/components/shared/container";
import { useSuspenseLeases } from "@/hooks/leases";
import { useSuspensePayments } from "@/hooks/payments";
import {
	useOptimisticCreateBatchUtility,
	useOptimisticRemoveUtility,
	useOptimisticUpdateUtility,
	useSuspenseUtilities,
} from "@/hooks/utilities";
import { downloadCsv } from "@/lib/payment-csv";
import {
	formatUtilityExportFilename,
	utilityExportRowsToCsv,
} from "@/lib/utility-csv";
import type { client } from "@/utils/orpc";
import { CombinedBillCard } from "./combined-bill-card";
import { type CombinedBillGroup, CombinedBillRow } from "./combined-bill-row";
import { ElectricityRow } from "./electricity-row";
import { FixedChargeRow } from "./fixed-charge-row";
import { UnitPickerUtilityForm } from "./lease-picker-form";
import { MarkCombinedPaidDialog } from "./mark-combined-paid-dialog";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { UtilityDetailDialog } from "./utility-detail-sheet";
import { UtilityGrid } from "./utility-grid";

// ── Types ────────────────────────────────────────────────────────────────────

type UtilityTab = "electricity" | "water" | "maintenance" | "combined";
type UtilityStatusFilter = "all" | "paid" | "unpaid";

type BatchItem = Parameters<
	typeof client.rent.utility.createUtilityBatch
>[0]["items"][number];

// ── Component ────────────────────────────────────────────────────────────────

export default function UtilitiesClient() {
	const { data } = useSuspenseUtilities();
	const { data: leasesData } = useSuspenseLeases();
	const { data: paymentsData } = useSuspensePayments();

	const createBatch = useOptimisticCreateBatchUtility();
	const updateUtility = useOptimisticUpdateUtility();
	const removeUtility = useOptimisticRemoveUtility();

	const createDialog = useFormDialog();
	// B07: one idempotency key per bill type, minted per dialog open and
	// stable across retries; cleared on close. Keyed by type (not index) so
	// toggling tabs between attempts cannot shift keys onto other bills.
	const batchItemKeysRef = useRef<Record<string, string>>({});
	if (!createDialog.open && Object.keys(batchItemKeysRef.current).length > 0) {
		batchItemKeysRef.current = {};
	}

	const [viewMode, setViewMode] = useState<"cards" | "rows">("cards");
	const [activeTab, setActiveTab] = useState<UtilityTab>("electricity");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<UtilityStatusFilter>("all");
	const [editTarget, setEditTarget] = useState<UtilityListItem | null>(null);
	const [detailItems, setDetailItems] = useState<UtilityListItem[]>([]);
	const [detailRent, setDetailRent] = useState<number | null>(null);
	const [markPaidTarget, setMarkPaidTarget] = useState<UtilityListItem | null>(
		null,
	);
	const [combinedPayOpen, setCombinedPayOpen] = useState(false);

	const utilities = data?.utilities ?? [];
	const leases = leasesData?.leases ?? [];
	const payments = paymentsData?.payments ?? [];

	// ── Derived: filter by type + search ─────────────────────────────────────
	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		const isPaidDerivedF = (u: (typeof utilities)[number]) =>
			((u as { amountDue?: number }).amountDue ?? u.totalAmount) <= 0;
		return utilities.filter((u) => {
			if (activeTab !== "combined" && u.utilityType !== activeTab) return false;
			if (statusFilter === "paid" && !isPaidDerivedF(u)) return false;
			if (statusFilter === "unpaid" && isPaidDerivedF(u)) return false;
			if (!q) return true;
			return (
				(u.tenantName ?? "").toLowerCase().includes(q) ||
				u.propertyName.toLowerCase().includes(q) ||
				u.unitNumber.toLowerCase().includes(q)
			);
		});
	}, [utilities, activeTab, search, statusFilter]);

	// ── Derived: stats ───────────────────────────────────────────────────────
	const pageStats = useMemo(() => {
		const getDue = (u: (typeof utilities)[number]) =>
			(u as { amountDue?: number }).amountDue ?? u.totalAmount;
		const isPaidDerived = (u: (typeof utilities)[number]) => getDue(u) <= 0;
		const totalBilled = utilities.reduce((acc, u) => acc + u.totalAmount, 0);
		const totalDue = utilities.reduce((acc, u) => acc + getDue(u), 0);
		const totalPaid = utilities
			.filter(isPaidDerived)
			.reduce((acc, u) => acc + u.totalAmount, 0);
		const totalUnpaid = totalDue;
		const paidRecords = utilities.filter(isPaidDerived).length;
		const totalRecords = utilities.length;
		const collectionRate =
			totalBilled > 0 ? Math.round((totalPaid / totalBilled) * 100) : 0;

		return {
			totalBilled,
			totalPaid,
			totalUnpaid,
			paidRecords,
			totalRecords,
			collectionRate,
		};
	}, [utilities]);

	// ── Derived: combined bills (group by leaseId, join with lease for rent) ──
	// WHY: "Combined Bills" is a pure client-side aggregation — no API needed.
	// For each leaseId that has utility entries, find the matching lease and
	// sum all utility totals. Then add the lease's rent for the grand total.
	const combinedGroups = useMemo((): CombinedBillGroup[] => {
		const map = new Map<string, CombinedBillGroup>();
		const rentPaidByLease = new Map<string, number>();
		for (const payment of payments) {
			if (
				payment.utilityId == null &&
				(payment.type === PAYMENT_TYPES.RENT ||
					payment.type === PAYMENT_TYPES.REVERSAL)
			) {
				rentPaidByLease.set(
					payment.leaseId,
					(rentPaidByLease.get(payment.leaseId) ?? 0) + payment.amount,
				);
			}
		}

		const getDueC = (u: (typeof utilities)[number]) =>
			(u as { amountDue?: number }).amountDue ?? u.totalAmount;
		const isPaidC = (u: (typeof utilities)[number]) => getDueC(u) <= 0;
		const getRentDue = (lease: (typeof leases)[number]) =>
			Math.max(0, lease.rent - (rentPaidByLease.get(lease.leaseId) ?? 0));

		for (const u of utilities) {
			const lease = leases.find((l) => l.leaseId === u.leaseId);
			if (!lease) continue; // skip orphaned utilities (shouldn't happen)
			const period = new Date(u.currentReadingDate);
			const periodKey = `${period.getFullYear()}-${period.getMonth()}`;
			const groupId = `${u.leaseId}-${periodKey}`;
			const due = Math.max(0, getDueC(u));
			const rentDue = getRentDue(lease);

			const existing = map.get(groupId);

			if (existing) {
				existing.utilities.push(u);
				if (u.utilityType === "electricity") existing.electricityTotal += due;
				if (u.utilityType === "water") existing.waterTotal += due;
				if (u.utilityType === "maintenance") existing.maintenanceTotal += due;
				existing.utilityTotal += due;
				existing.grandTotal += due;
				existing.allPaid = existing.allPaid && isPaidC(u) && rentDue <= 0;
			} else {
				map.set(groupId, {
					id: groupId,
					period: period,
					lease,
					utilities: [u],
					electricityTotal: u.utilityType === "electricity" ? due : 0,
					waterTotal: u.utilityType === "water" ? due : 0,
					maintenanceTotal: u.utilityType === "maintenance" ? due : 0,
					utilityTotal: due,
					rentDue,
					grandTotal: rentDue + due,
					allPaid: isPaidC(u) && rentDue <= 0,
				});
			}
		}

		return Array.from(map.values()).sort(
			(a, b) =>
				b.period.getTime() - a.period.getTime() ||
				(a.lease.tenantName ?? "").localeCompare(b.lease.tenantName ?? ""),
		);
	}, [utilities, leases, payments]);

	const filteredCombinedGroups = useMemo(() => {
		const q = search.toLowerCase();
		return combinedGroups.filter((group) => {
			if (statusFilter === "paid" && !group.allPaid) return false;
			if (statusFilter === "unpaid" && group.allPaid) return false;
			if (!q) return true;
			return (
				(group.lease.tenantName ?? "").toLowerCase().includes(q) ||
				group.lease.propertyName.toLowerCase().includes(q) ||
				group.lease.unitNumber.toLowerCase().includes(q)
			);
		});
	}, [combinedGroups, search, statusFilter]);

	// ── Handlers ─────────────────────────────────────────────────────────────

	function handleCreate(values: UtilityBatchFormValues) {
		const sharedItemFields = {
			leaseId: values.leaseId,
			batchId: values.batchId,
			previousReadingDate: new Date(values.previousReadingDate),
			currentReadingDate: new Date(values.currentReadingDate),
		};

		const items: BatchItem[] = [];

		const itemKey = (utilityType: string) => {
			const retained = batchItemKeysRef.current[utilityType];
			if (retained) return retained;
			const fresh = crypto.randomUUID();
			batchItemKeysRef.current[utilityType] = fresh;
			return fresh;
		};

		if (values.electricity) {
			// WHY: destructure to drop isPaid — CreateUtilitySchema omits it intentionally
			const { isPaid: _isPaid, ...elecFields } = values.electricity;
			items.push({
				utilityType: "electricity" as const,
				...sharedItemFields,
				...elecFields,
				ratePerUnit: toPaise(elecFields.ratePerUnit),
				fixedCharge: toPaise(elecFields.fixedCharge),
				idempotencyKey: itemKey("electricity"),
			});
		}

		if (values.water) {
			const { isPaid: _isPaid, ...waterFields } = values.water;
			// WHY: water/maintenance are flat charges — no meter, but BatchItemSchema
			// inherits previousReading/currentReading as required from CreateUtilitySchema.
			// Zero is semantically correct: unitsUsed = max(0, 0 - 0) = 0, bill = fixedCharge.
			items.push({
				utilityType: "water" as const,
				...sharedItemFields,
				previousReading: 0,
				currentReading: 0,
				...waterFields,
				fixedCharge: toPaise(waterFields.fixedCharge),
				idempotencyKey: itemKey("water"),
			});
		}

		if (values.maintenance) {
			const { isPaid: _isPaid, ...maintFields } = values.maintenance;
			items.push({
				utilityType: "maintenance" as const,
				...sharedItemFields,
				previousReading: 0,
				currentReading: 0,
				...maintFields,
				fixedCharge: toPaise(maintFields.fixedCharge),
				idempotencyKey: itemKey("maintenance"),
			});
		}

		createBatch.mutate(
			{ leaseId: values.leaseId, batchId: values.batchId, items },
			{ onSuccess: () => createDialog.closeDialog() },
		);
	}

	// ── Row-mode handlers ──────────────────────────────────────────────────

	function handleUpdate(values: UtilityBatchFormValues) {
		if (!editTarget) return;

		const typeFields = (() => {
			if (editTarget.utilityType === "electricity" && values.electricity) {
				const { isPaid: _isPaid, ...rest } = values.electricity;
				return {
					...rest,
					ratePerUnit: toPaise(rest.ratePerUnit),
					fixedCharge: toPaise(rest.fixedCharge),
				};
			}
			if (editTarget.utilityType === "water" && values.water) {
				const { isPaid: _isPaid, ...rest } = values.water;
				return { ...rest, fixedCharge: toPaise(rest.fixedCharge) };
			}
			if (editTarget.utilityType === "maintenance" && values.maintenance) {
				const { isPaid: _isPaid, ...rest } = values.maintenance;
				return { ...rest, fixedCharge: toPaise(rest.fixedCharge) };
			}
			return {} as const;
		})();

		updateUtility.mutate(
			{
				id: editTarget.id,
				data: {
					previousReadingDate: new Date(values.previousReadingDate),
					currentReadingDate: new Date(values.currentReadingDate),
					...typeFields,
				},
			},
			{ onSuccess: () => setEditTarget(null) },
		);
	}

	function handleDelete(id: string) {
		removeUtility.mutate({ id });
	}

	function openUtilityDetail(utility: UtilityListItem) {
		setDetailRent(null);
		setDetailItems(
			utility.batchId
				? utilities.filter((item) => item.batchId === utility.batchId)
				: [utility],
		);
	}

	function handleExportCsv() {
		downloadCsv(
			utilityExportRowsToCsv(utilities),
			formatUtilityExportFilename(),
		);
	}

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				<PageHeader
					title="Utilities"
					description="Track electricity, water, and maintenance charges"
				>
					<Button variant="outline" onClick={handleExportCsv}>
						<IconDownload className="size-4" />
						Export CSV
					</Button>
					<Button onClick={createDialog.openDialog}>
						<IconPlus className="size-4" />
						Add Reading
					</Button>
				</PageHeader>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="grid divide-y sm:grid-cols-[1.05fr_1fr] sm:divide-x sm:divide-y-0">
						<div className="relative overflow-hidden bg-gradient-to-br from-primary/[0.08] via-card to-card p-5">
							<div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/[0.08] blur-2xl" />
							<div className="relative">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
									Collection health
								</p>
								<p className="mt-1 font-semibold text-3xl tracking-tight">
									{formatRupees(pageStats.totalUnpaid)}{" "}
									<span className="font-normal text-base text-muted-foreground">
										outstanding
									</span>
								</p>
								<div className="mt-4 h-1.5 max-w-sm overflow-hidden rounded-full bg-primary/10">
									<div
										className="h-full rounded-full bg-primary transition-all"
										style={{ width: `${pageStats.collectionRate}%` }}
									/>
								</div>
								<p className="mt-2 text-muted-foreground text-xs">
									{pageStats.collectionRate}% collected ·{" "}
									{pageStats.paidRecords} of {pageStats.totalRecords} bills
									settled
								</p>
							</div>
						</div>
						<div className="grid grid-cols-3 divide-x">
							<UtilityMetric
								icon={IconFileInvoice}
								label="Total billed"
								value={formatRupees(pageStats.totalBilled)}
							/>
							<UtilityMetric
								icon={IconReceipt}
								label="Settled"
								value={formatRupees(pageStats.totalPaid)}
							/>
							<UtilityMetric
								icon={IconAlertTriangle}
								label="Outstanding"
								value={formatRupees(pageStats.totalUnpaid)}
							/>
						</div>
					</div>
				</section>

				{/* Tab bar */}
				<div
					role="tablist"
					aria-label="Utility type"
					className="mb-5 flex max-w-full gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1"
				>
					<TabBtn
						active={activeTab === "electricity"}
						onClick={() => setActiveTab("electricity")}
						icon={<IconBolt className="size-3.5" />}
						label="Electricity"
						count={
							utilities.filter((u) => u.utilityType === "electricity").length
						}
					/>
					<TabBtn
						active={activeTab === "water"}
						onClick={() => setActiveTab("water")}
						icon={<IconDroplet className="size-3.5" />}
						label="Water"
						count={utilities.filter((u) => u.utilityType === "water").length}
					/>
					<TabBtn
						active={activeTab === "maintenance"}
						onClick={() => setActiveTab("maintenance")}
						icon={<IconTool className="size-3.5" />}
						label="Maintenance"
						count={
							utilities.filter((u) => u.utilityType === "maintenance").length
						}
					/>
					<TabBtn
						active={activeTab === "combined"}
						onClick={() => setActiveTab("combined")}
						icon={<IconFileInvoice className="size-3.5" />}
						label="Combined Bills"
						count={combinedGroups.length}
					/>
				</div>

				{activeTab !== "combined" ? (
					<div>
						<div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
							<div className="relative min-w-0 sm:w-72">
								<IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
								<Input
									aria-label="Search utilities"
									placeholder="Search tenant, property, or unit"
									value={search}
									onChange={(event) => setSearch(event.target.value)}
									className="w-full pl-8"
								/>
							</div>
							<div className="flex items-center gap-2">
								<select
									aria-label="Filter utility payment status"
									value={statusFilter}
									onChange={(event) =>
										setStatusFilter(event.target.value as UtilityStatusFilter)
									}
									className="h-7 rounded-md border bg-background px-2 text-xs outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
								>
									<option value="all">All statuses</option>
									<option value="paid">Paid</option>
									<option value="unpaid">Unpaid</option>
								</select>
								<div className="flex items-center rounded-md border bg-muted/30 p-0.5">
									<button
										type="button"
										onClick={() => setViewMode("cards")}
										className={`rounded-sm p-1.5 transition-colors ${
											viewMode === "cards"
												? "bg-white text-foreground shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
										title="Card view"
									>
										<IconLayoutGrid className="size-3.5" />
									</button>
									<button
										type="button"
										onClick={() => setViewMode("rows")}
										className={`rounded-sm p-1.5 transition-colors ${
											viewMode === "rows"
												? "bg-white text-foreground shadow-sm"
												: "text-muted-foreground hover:text-foreground"
										}`}
										title="Row view"
									>
										<IconList className="size-3.5" />
									</button>
								</div>
							</div>
						</div>

						{viewMode === "cards" ? (
							<UtilityGrid
								utilities={filtered}
								allUtilities={utilities}
								onCreate={createDialog.openDialog}
							/>
						) : filtered.length === 0 ? (
							<div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
								<p className="text-muted-foreground">
									No readings found.
									{search ? " Try clearing the search." : ""}
								</p>
							</div>
						) : (
							<div className="overflow-hidden rounded-xl border bg-white">
								<UtilityTableHeader />
								{filtered.map((u) => {
									const isDeleting =
										removeUtility.isPending &&
										removeUtility.variables?.id === u.id;

									const sharedProps = {
										utility: u,
										onEdit: () => setEditTarget(u),
										onDelete: () => handleDelete(u.id),
										onMarkPaid: () => setMarkPaidTarget(u),
										onViewDetail: () => openUtilityDetail(u),
										isDeleting,
									};

									if (u.utilityType === "electricity") {
										return <ElectricityRow key={u.id} {...sharedProps} />;
									}
									return <FixedChargeRow key={u.id} {...sharedProps} />;
								})}
							</div>
						)}
					</div>
				) : (
					<div>
						<div className="mb-5 flex items-center justify-end">
							<div className="flex items-center rounded-md border bg-muted/30 p-0.5">
								<button
									type="button"
									onClick={() => setViewMode("cards")}
									className={`rounded-sm p-1.5 transition-colors ${
										viewMode === "cards"
											? "bg-white text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									title="Card view"
								>
									<IconLayoutGrid className="size-3.5" />
								</button>
								<button
									type="button"
									onClick={() => setViewMode("rows")}
									className={`rounded-sm p-1.5 transition-colors ${
										viewMode === "rows"
											? "bg-white text-foreground shadow-sm"
											: "text-muted-foreground hover:text-foreground"
									}`}
									title="Row view"
								>
									<IconList className="size-3.5" />
								</button>
							</div>
						</div>

						{filteredCombinedGroups.length === 0 ? (
							<div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-16 text-center">
								<p className="text-muted-foreground">
									{combinedGroups.length === 0
										? "No utility data yet. Add readings to see combined bills."
										: "No combined bills match these filters."}
								</p>
							</div>
						) : viewMode === "cards" ? (
							<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
								{filteredCombinedGroups.map((group) => (
									<CombinedBillCard
										key={group.id}
										group={group}
										onViewDetail={() => {
											setDetailRent(group.rentDue);
											setDetailItems(group.utilities);
										}}
									/>
								))}
							</div>
						) : (
							<div className="overflow-hidden rounded-xl border bg-white">
								{filteredCombinedGroups.map((group) => (
									<CombinedBillRow
										key={group.id}
										group={group}
										onViewDetail={() => {
											setDetailRent(group.rentDue);
											setDetailItems(group.utilities);
										}}
									/>
								))}
							</div>
						)}
					</div>
				)}

				{/* ── Dialogs ─────────────────────────────────────────────────── */}

				<FormDialog
					open={createDialog.open}
					onOpenChange={createDialog.onOpenChange}
					title="Add utility charge"
					description="Select a tenant and record one or more charges for the same billing period."
					formId="create-utility-form"
					isSubmitting={createBatch.isPending}
					submitLabel="Add Reading"
					size="lg"
				>
					<UnitPickerUtilityForm
						key={createDialog.open ? "open" : "closed"}
						leases={leases}
						onSubmit={handleCreate}
						isSubmitting={createBatch.isPending}
						initialType={activeTab === "combined" ? undefined : activeTab}
						formId="create-utility-form"
					/>
				</FormDialog>

				{editTarget && (
					<FormDialog
						open={editTarget !== null}
						onOpenChange={(o) => !o && setEditTarget(null)}
						title="Edit utility charge"
						formId="edit-utility-row-form"
						isSubmitting={updateUtility.isPending}
						submitLabel="Save Changes"
					>
						<UtilityForm
							key={editTarget.id}
							leaseId={editTarget.leaseId}
							formId="edit-utility-row-form"
							defaultValues={mapUtilityToFormDefaults(editTarget)}
							onSubmit={handleUpdate}
							isSubmitting={updateUtility.isPending}
						/>
					</FormDialog>
				)}

				<UtilityDetailDialog
					items={detailItems}
					rent={detailRent}
					open={detailItems.length > 0}
					onOpenChange={(open) => {
						if (!open) {
							setDetailItems([]);
							setDetailRent(null);
						}
					}}
					onMarkPaid={(utility) => {
						setDetailItems([]);
						setDetailRent(null);
						setMarkPaidTarget(utility);
					}}
					onMarkPaidCombined={() => setCombinedPayOpen(true)}
					onEdit={(utility) => {
						setDetailItems([]);
						setDetailRent(null);
						setEditTarget(utility);
					}}
				/>

				{/* Mark paid dialog */}
				<MarkPaidDialog
					utility={markPaidTarget}
					open={markPaidTarget !== null}
					onOpenChange={(o) => !o && setMarkPaidTarget(null)}
				/>
				<MarkCombinedPaidDialog
					items={detailItems}
					rent={detailRent}
					open={combinedPayOpen}
					onOpenChange={(o) => {
						if (!o) setCombinedPayOpen(false);
						else setCombinedPayOpen(true);
					}}
					onCompleted={() => {
						setDetailItems([]);
						setDetailRent(null);
						setCombinedPayOpen(false);
					}}
				/>
			</div>
		</Container>
	);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function UtilityMetric({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof IconFileInvoice;
	label: string;
	value: string;
}) {
	return (
		<div className="min-w-0 px-3 py-5 text-center sm:px-4">
			<Icon className="mx-auto size-4 text-primary" />
			<p className="mt-2 truncate text-muted-foreground text-xs">{label}</p>
			<p className="mt-1 truncate font-semibold text-sm sm:text-base">
				{value}
			</p>
		</div>
	);
}

function TabBtn({
	active,
	onClick,
	icon,
	label,
	count,
}: {
	active: boolean;
	onClick: () => void;
	icon: React.ReactNode;
	label: string;
	count: number;
}) {
	return (
		<button
			type="button"
			role="tab"
			aria-selected={active}
			onClick={onClick}
			className={`flex shrink-0 items-center gap-1.5 rounded-md px-4 py-2 font-medium text-sm transition-all ${
				active
					? "bg-white text-foreground shadow-sm"
					: "text-muted-foreground hover:text-foreground"
			}`}
		>
			{icon}
			{label}
			{count > 0 && (
				<span
					className={`rounded-full px-1.5 py-0.5 font-bold text-[10px] ${
						active
							? "bg-primary/10 text-primary"
							: "bg-muted text-muted-foreground"
					}`}
				>
					{count}
				</span>
			)}
		</button>
	);
}

function UtilityTableHeader() {
	return (
		<div className="hidden grid-cols-[minmax(13rem,1.4fr)_minmax(9rem,1fr)_minmax(8rem,.8fr)_minmax(7rem,.7fr)_minmax(6rem,.55fr)_minmax(15rem,auto)] items-center gap-4 border-b bg-muted/30 px-5 py-2.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider lg:grid">
			<span>Tenant & property</span>
			<span>Service period</span>
			<span className="text-center">Usage / charge</span>
			<span className="text-center">Amount</span>
			<span className="text-center">Status</span>
			<span className="text-right">Actions</span>
		</div>
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
			: new Date().toISOString().split("T")[0],
	};

	if (u.utilityType === "electricity") {
		return {
			...base,
			electricity: {
				previousReading: Number(u.previousReading),
				currentReading: Number(u.currentReading),
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
