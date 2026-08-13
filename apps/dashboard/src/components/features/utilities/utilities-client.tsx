"use client";

import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";

import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import {
	formatRupees,
	paiseToFormValue,
	toPaise,
} from "@rently/ui/lib/currency";
import { PageHeader } from "@rently/ui/shared/page-header";
import type {
	UtilityBatchFormValues,
	UtilityListItem,
} from "@rently/validators";
import {
	IconBolt,
	IconDownload,
	IconDroplet,
	IconFileInvoice,
	IconPlus,
	IconReceipt,
	IconSearch,
	IconTool,
} from "@tabler/icons-react";
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
import { downloadCsv } from "@/lib/payment-csv";
import {
	formatUtilityExportFilename,
	utilityExportRowsToCsv,
} from "@/lib/utility-csv";
import type { client } from "@/utils/orpc";
import { type CombinedBillGroup, CombinedBillRow } from "./combined-bill-row";
import { ElectricityRow } from "./electricity-row";
import { FixedChargeRow } from "./fixed-charge-row";
import { UnitPickerUtilityForm } from "./lease-picker-form";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { UtilityDetailDialog } from "./utility-detail-sheet";

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

	const createBatch = useOptimisticCreateBatchUtility();
	const updateUtility = useOptimisticUpdateUtility();
	const removeUtility = useOptimisticRemoveUtility();

	const [activeTab, setActiveTab] = useState<UtilityTab>("electricity");
	const [search, setSearch] = useState("");
	const [statusFilter, setStatusFilter] = useState<UtilityStatusFilter>("all");
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<UtilityListItem | null>(null);
	const [detailItems, setDetailItems] = useState<UtilityListItem[]>([]);
	const [detailRent, setDetailRent] = useState<number | null>(null);
	const [markPaidTarget, setMarkPaidTarget] = useState<UtilityListItem | null>(
		null,
	);

	const utilities = data?.utilities ?? [];
	const leases = leasesData?.leases ?? [];

	// ── Derived: filter by type + search ─────────────────────────────────────
	const filtered = useMemo(() => {
		const q = search.toLowerCase();
		return utilities.filter((u) => {
			if (activeTab !== "combined" && u.utilityType !== activeTab) return false;
			if (statusFilter === "paid" && !u.isPaid) return false;
			if (statusFilter === "unpaid" && u.isPaid) return false;
			if (!q) return true;
			return (
				(u.tenantName ?? "").toLowerCase().includes(q) ||
				u.propertyName.toLowerCase().includes(q) ||
				u.unitNumber.toLowerCase().includes(q)
			);
		});
	}, [utilities, activeTab, search, statusFilter]);

	// ── Derived: stats ───────────────────────────────────────────────────────
	const stats = useMemo(() => {
		const thisMonth = new Date().getMonth();
		const thisYear = new Date().getFullYear();

		const monthlyUtilities = utilities.filter((u) => {
			const d = new Date(u.currentReadingDate);
			return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
		});

		const sum = (arr: UtilityListItem[]) =>
			arr.reduce((acc, u) => acc + u.totalAmount, 0);

		return {
			totalBills: sum(monthlyUtilities),
			monthlyCount: monthlyUtilities.length,
			paidTotal: sum(monthlyUtilities.filter((u) => u.isPaid)),
			paidCount: monthlyUtilities.filter((u) => u.isPaid).length,
			unpaidTotal: sum(utilities.filter((u) => !u.isPaid)),
			unpaidCount: utilities.filter((u) => !u.isPaid).length,
			electricityCount: utilities.filter((u) => u.utilityType === "electricity")
				.length,
			waterCount: utilities.filter((u) => u.utilityType === "water").length,
			maintenanceCount: utilities.filter((u) => u.utilityType === "maintenance")
				.length,
		};
	}, [utilities]);

	// ── Derived: combined bills (group by leaseId, join with lease for rent) ──
	// WHY: "Combined Bills" is a pure client-side aggregation — no API needed.
	// For each leaseId that has utility entries, find the matching lease and
	// sum all utility totals. Then add the lease's rent for the grand total.
	const combinedGroups = useMemo((): CombinedBillGroup[] => {
		const map = new Map<string, CombinedBillGroup>();

		for (const u of utilities) {
			const lease = leases.find((l) => l.leaseId === u.leaseId);
			if (!lease) continue; // skip orphaned utilities (shouldn't happen)
			const period = new Date(u.currentReadingDate);
			const periodKey = `${period.getFullYear()}-${period.getMonth()}`;
			const groupId = `${u.leaseId}-${periodKey}`;

			const existing = map.get(groupId);

			if (existing) {
				existing.utilities.push(u);
				if (u.utilityType === "electricity")
					existing.electricityTotal += u.totalAmount;
				if (u.utilityType === "water") existing.waterTotal += u.totalAmount;
				if (u.utilityType === "maintenance")
					existing.maintenanceTotal += u.totalAmount;
				existing.utilityTotal += u.totalAmount;
				existing.grandTotal += u.totalAmount;
				existing.allPaid = existing.allPaid && u.isPaid;
			} else {
				map.set(groupId, {
					id: groupId,
					period: period,
					lease,
					utilities: [u],
					electricityTotal: u.utilityType === "electricity" ? u.totalAmount : 0,
					waterTotal: u.utilityType === "water" ? u.totalAmount : 0,
					maintenanceTotal: u.utilityType === "maintenance" ? u.totalAmount : 0,
					utilityTotal: u.totalAmount,
					// grandTotal starts with rent + this first utility
					grandTotal: lease.rent + u.totalAmount,
					allPaid: u.isPaid,
				});
			}
		}

		return Array.from(map.values()).sort(
			(a, b) =>
				b.period.getTime() - a.period.getTime() ||
				(a.lease.tenantName ?? "").localeCompare(b.lease.tenantName ?? ""),
		);
	}, [utilities, leases]);

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

		if (values.electricity) {
			// WHY: destructure to drop isPaid — CreateUtilitySchema omits it intentionally
			const { isPaid: _isPaid, ...elecFields } = values.electricity;
			items.push({
				utilityType: "electricity" as const,
				...sharedItemFields,
				...elecFields,
				ratePerUnit: toPaise(elecFields.ratePerUnit),
				fixedCharge: toPaise(elecFields.fixedCharge),
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
			});
		}

		createBatch.mutate(
			{ leaseId: values.leaseId, batchId: values.batchId, items },
			{ onSuccess: () => setCreateOpen(false) },
		);
	}

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
				return {
					...rest,
					fixedCharge: toPaise(rest.fixedCharge),
				};
			}
			if (editTarget.utilityType === "maintenance" && values.maintenance) {
				const { isPaid: _isPaid, ...rest } = values.maintenance;
				return {
					...rest,
					fixedCharge: toPaise(rest.fixedCharge),
				};
			}
			return {} as const;
		})();

		updateUtility.mutate(
			{
				id: editTarget.id,
				data: {
					// WHY: form stores dates as ISO strings; UpdateUtilitySchema
					// inherits Date type from drizzle-zod's timestamp column inference
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

	function handleExportCsv() {
		downloadCsv(
			utilityExportRowsToCsv(utilities),
			formatUtilityExportFilename(),
		);
	}

	function openUtilityDetail(utility: UtilityListItem) {
		setDetailRent(null);
		setDetailItems(
			utility.batchId
				? utilities.filter((item) => item.batchId === utility.batchId)
				: [utility],
		);
	}

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<Container>
			{/* Page header */}
			<PageHeader
				title="Utilities"
				description="Track electricity, water, and maintenance charges"
			>
				<Button variant="outline" onClick={handleExportCsv}>
					<IconDownload className="size-4" />
					Export CSV
				</Button>
				<Button onClick={() => setCreateOpen(true)}>
					<IconPlus className="size-4" />
					Add Reading
				</Button>
			</PageHeader>

			{/* Stat cards */}
			<div className="my-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
				<StatCard
					icon={<IconFileInvoice className="size-5" />}
					label="Billed this month"
					value={formatRupees(stats.totalBills)}
					sub={`${stats.monthlyCount} ${stats.monthlyCount === 1 ? "bill" : "bills"}`}
					accent
				/>
				<StatCard
					icon={<IconReceipt className="size-5 text-emerald-600" />}
					label="Settled bill value"
					value={formatRupees(stats.paidTotal)}
					sub={`${stats.paidCount} of ${stats.monthlyCount} bills this month`}
				/>
				<StatCard
					icon={<IconBolt className="size-5 text-destructive" />}
					label="Outstanding balance"
					value={formatRupees(stats.unpaidTotal)}
					sub={`${stats.unpaidCount} ${stats.unpaidCount === 1 ? "bill needs" : "bills need"} attention`}
					danger={stats.unpaidCount > 0}
				/>
				<StatCard
					icon={<IconTool className="size-5 text-violet-600" />}
					label="Utility records"
					value={utilities.length.toLocaleString("en-IN")}
					sub={`${stats.electricityCount} electricity · ${stats.waterCount} water · ${stats.maintenanceCount} maintenance`}
				/>
			</div>

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

			{/* Tab content */}
			<div className="overflow-hidden rounded-xl border bg-white">
				{/* Tab header */}
				<div className="flex flex-col gap-4 border-b px-4 py-4 lg:flex-row lg:items-center lg:justify-between lg:px-5">
					<div>
						<p className="font-semibold text-sm capitalize">
							{activeTab === "combined"
								? "Combined Bills"
								: `${activeTab} Readings`}
						</p>
						<p className="text-muted-foreground text-xs">
							{activeTab === "combined"
								? `${filteredCombinedGroups.length} monthly tenant summaries`
								: `${filtered.length} ${activeTab === "electricity" ? "meter readings" : "charges"}`}
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
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
					</div>
				</div>

				{activeTab !== "combined" && filtered.length > 0 ? (
					<UtilityTableHeader />
				) : null}

				{/* Rows */}
				{activeTab === "combined" ? (
					filteredCombinedGroups.length === 0 ? (
						<EmptyStateRow
							message={
								search || statusFilter !== "all"
									? "No combined bills match these filters."
									: "No utility data yet. Add readings to see combined bills."
							}
						/>
					) : (
						filteredCombinedGroups.map((group) => (
							<CombinedBillRow
								key={group.id}
								group={group}
								onViewDetail={() => {
									setDetailRent(group.lease.rent);
									setDetailItems(group.utilities);
								}}
							/>
						))
					)
				) : filtered.length === 0 ? (
					<EmptyStateRow
						message={`No ${activeTab} readings found.${search ? " Try clearing the search." : ""}`}
					/>
				) : (
					filtered.map((u) => {
						const isDeleting =
							removeUtility.isPending && removeUtility.variables?.id === u.id;

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
						// water + maintenance both use the flat charge row
						return <FixedChargeRow key={u.id} {...sharedProps} />;
					})
				)}
			</div>

			{/* ── Dialogs ─────────────────────────────────────────────────── */}

			{/* Create dialog */}
			<Dialog open={createOpen} onOpenChange={setCreateOpen}>
				<DialogContent className="max-h-[calc(100vh-2rem)] overflow-y-auto sm:max-w-xl">
					<DialogHeader>
						<DialogTitle>Add utility charge</DialogTitle>
						<DialogDescription>
							Select a tenant and record one or more charges for the same
							billing period.
						</DialogDescription>
					</DialogHeader>
					<UnitPickerUtilityForm
						leases={leases}
						onSubmit={handleCreate}
						isSubmitting={createBatch.isPending}
						initialType={activeTab === "combined" ? undefined : activeTab}
					/>
				</DialogContent>
			</Dialog>

			{/* Edit dialog */}
			<Dialog
				open={editTarget !== null}
				onOpenChange={(o) => !o && setEditTarget(null)}
			>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle>Edit utility charge</DialogTitle>
						<DialogDescription>
							Update the billing period and charge details. The total will be
							recalculated automatically.
						</DialogDescription>
					</DialogHeader>
					{editTarget && (
						<UtilityForm
							leaseId={editTarget.leaseId}
							defaultValues={mapUtilityToFormDefaults(editTarget)}
							onSubmit={handleUpdate}
							isSubmitting={updateUtility.isPending}
							submitLabel="Save Changes"
						/>
					)}
				</DialogContent>
			</Dialog>

			{/* Detail dialog */}
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
		</Container>
	);
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({
	icon,
	label,
	value,
	sub,
	accent,
	danger,
}: {
	icon: React.ReactNode;
	label: string;
	value: string;
	sub: string;
	accent?: boolean;
	danger?: boolean;
}) {
	return (
		<div
			className={`rounded-xl border p-4 ${
				accent
					? "border-primary/20 bg-primary text-primary-foreground"
					: danger
						? "border-destructive/20 bg-destructive/5"
						: "bg-white"
			}`}
		>
			<div
				className={`mb-3 flex size-9 items-center justify-center rounded-lg ${accent ? "bg-white/20" : "bg-muted"}`}
			>
				{icon}
			</div>
			<p
				className={`text-xs ${accent ? "text-primary-foreground/75" : "text-muted-foreground"}`}
			>
				{label}
			</p>
			<p
				className={`mt-1 font-bold text-2xl tracking-tight ${danger ? "text-destructive" : ""}`}
			>
				{value}
			</p>
			<p
				className={`mt-1 text-xs ${accent ? "text-primary-foreground/75" : "text-muted-foreground"}`}
			>
				{sub}
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

function EmptyStateRow({ message }: { message: string }) {
	return (
		<div className="flex items-center justify-center px-5 py-12 text-center">
			<p className="text-muted-foreground text-sm">{message}</p>
		</div>
	);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
				// WHY paiseToFormValue: DB stores paise; form expects rupees
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
