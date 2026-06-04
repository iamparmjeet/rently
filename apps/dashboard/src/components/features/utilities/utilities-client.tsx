"use client";

import {
	FIXEDCHARGE,
	RATEPERUNIT,
} from "@rently/db/constants/payment-constants";

import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import {
	formatFormRupees,
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
	IconDroplet,
	IconFileInvoice,
	IconPlus,
	IconReceipt,
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
import type { client } from "@/utils/orpc";
import { type CombinedBillGroup, CombinedBillRow } from "./combined-bill-row";
import { ElectricityRow } from "./electricity-row";
import { FixedChargeRow } from "./fixed-charge-row";
import { UnitPickerUtilityForm } from "./lease-picker-form";
import { MarkPaidDialog } from "./mark-paid-dialog";
import { UtilityDetailSheet } from "./utility-detail-sheet";

// ── Types ────────────────────────────────────────────────────────────────────

type UtilityTab = "electricity" | "water" | "maintenance" | "combined";

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
	const [createOpen, setCreateOpen] = useState(false);
	const [editTarget, setEditTarget] = useState<UtilityListItem | null>(null);
	const [detailTarget, setDetailTarget] = useState<UtilityListItem | null>(
		null,
	);
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
			if (!q) return true;
			return (
				(u.tenantName ?? "").toLowerCase().includes(q) ||
				u.propertyName.toLowerCase().includes(q) ||
				u.unitNumber.toLowerCase().includes(q)
			);
		});
	}, [utilities, activeTab, search]);

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
			waterTotal: sum(
				monthlyUtilities.filter((u) => u.utilityType === "water"),
			),
			maintenanceTotal: sum(
				monthlyUtilities.filter((u) => u.utilityType === "maintenance"),
			),
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

			const existing = map.get(u.leaseId);

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
				map.set(u.leaseId, {
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

		return Array.from(map.values()).sort((a, b) =>
			(a.lease.tenantName ?? "").localeCompare(b.lease.tenantName ?? ""),
		);
	}, [utilities, leases]);

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

	// ── Batch items for detail sheet (all utilities with same batchId) ────────
	const batchItems = useMemo(() => {
		if (!detailTarget?.batchId) return detailTarget ? [detailTarget] : [];
		return utilities.filter((u) => u.batchId === detailTarget.batchId);
	}, [detailTarget, utilities]);

	// ── Render ────────────────────────────────────────────────────────────────

	return (
		<Container>
			{/* Page header */}
			<PageHeader
				title="Utilities"
				description="Track electricity, water, and maintenance charges"
			>
				<Button onClick={() => setCreateOpen(true)}>
					<IconPlus className="size-4" />
					Add Reading
				</Button>
			</PageHeader>

			{/* Stat cards */}
			<div className="my-5 grid grid-cols-4 gap-3">
				<StatCard
					icon={<IconReceipt className="size-5 text-primary" />}
					label="Bills This Month"
					value={formatRupees(stats.totalBills)}
					sub={`${stats.electricityCount + stats.waterCount + stats.maintenanceCount} entries`}
					accent
				/>
				<StatCard
					icon={<IconDroplet className="size-5 text-sky-600" />}
					label="Water Charges"
					value={formatRupees(stats.waterTotal)}
					sub={`${stats.waterCount} units`}
				/>
				<StatCard
					icon={<IconTool className="size-5 text-violet-600" />}
					label="Maintenance"
					value={formatRupees(stats.maintenanceTotal)}
					sub={`${stats.maintenanceCount} jobs`}
				/>
				<StatCard
					icon={<IconBolt className="size-5 text-destructive" />}
					label="Unpaid Bills"
					value={formatRupees(stats.unpaidTotal)}
					sub={`${stats.unpaidCount} pending`}
					danger={stats.unpaidCount > 0}
				/>
			</div>

			{/* Tab bar */}
			<div className="mb-5 flex w-fit gap-1 rounded-lg border bg-muted/40 p-1">
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

			{/* Combined bills tab has no per-type filter, others have search */}
			{activeTab !== "combined" && (
				<div className="mb-4 flex items-center gap-3">
					<Input
						placeholder={`Search ${activeTab} readings...`}
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						className="max-w-sm"
					/>
					<Button
						variant="outline"
						size="sm"
						onClick={() => setCreateOpen(true)}
						className="ml-auto"
					>
						<IconPlus className="size-3.5" />
						Add {activeTab === "electricity" ? "Reading" : "Bill"}
					</Button>
				</div>
			)}

			{/* Tab content */}
			<div className="overflow-hidden rounded-xl border bg-white">
				{/* Tab header */}
				<div className="flex items-center justify-between border-b px-5 py-3">
					<div>
						<p className="font-semibold text-sm capitalize">
							{activeTab === "combined"
								? "Combined Bills"
								: `${activeTab} Readings`}
						</p>
						<p className="text-muted-foreground text-xs">
							{activeTab === "combined"
								? "Rent + utilities breakdown per tenant"
								: activeTab === "electricity"
									? `Rate: ${formatFormRupees(RATEPERUNIT)}/unit (default)`
									: "Flat charges per unit"}
						</p>
					</div>
					{activeTab === "electricity" && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => setCreateOpen(true)}
						>
							<IconPlus className="size-3.5" />
							Add Reading
						</Button>
					)}
					{activeTab === "combined" && (
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								// TODO: Generate all bills action
							}}
						>
							Generate All
						</Button>
					)}
				</div>

				{/* Rows */}
				{activeTab === "combined" ? (
					combinedGroups.length === 0 ? (
						<EmptyStateRow message="No utility data yet. Add readings to see combined bills." />
					) : (
						combinedGroups.map((group) => (
							<CombinedBillRow key={group.lease.leaseId} group={group} />
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
							onViewDetail: () => setDetailTarget(u),
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
				<DialogContent className="">
					<DialogHeader>
						<DialogTitle>Add Reading / Bill</DialogTitle>
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
						<DialogTitle>Edit Reading</DialogTitle>
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

			{/* Detail sheet */}
			<UtilityDetailSheet
				items={batchItems}
				open={detailTarget !== null}
				onOpenChange={(o) => !o && setDetailTarget(null)}
				onMarkPaid={setMarkPaidTarget}
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
			onClick={onClick}
			className={`flex items-center gap-1.5 rounded-md px-4 py-2 font-medium text-sm transition-all ${
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
