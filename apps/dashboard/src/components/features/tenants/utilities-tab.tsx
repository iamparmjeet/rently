"use client";

import { RATEPERUNIT } from "@rently/db/constants/payment-constants";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { formatRupees, toPaise } from "@rently/ui/lib/currency";
import type {
	TenantDetail,
	UtilityBatchFormValues,
	UtilityListItem,
} from "@rently/validators";
import { IconBolt, IconDroplet, IconPlus, IconTool } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { UtilityForm } from "@/components/forms/utility-form";
import { useOptimisticCreateBatchUtility } from "@/hooks/utilities";
import type { client } from "@/utils/orpc";

//  API batch item type ******
type BatchItem = Parameters<
	typeof client.rent.utility.createUtilityBatch
>[0]["items"][number];

// ── WHY this function exists: UtilityForm emits UtilityBatchFormValues
//    (human-facing form shape with rupee values), but the API expects a flat
//    `items` array with paise values and Date objects. This is the ACL layer.
function buildBatchItems(values: UtilityBatchFormValues): BatchItem[] {
	const shared = {
		leaseId: values.leaseId,
		batchId: values.batchId,
		previousReadingDate: new Date(values.previousReadingDate),
		currentReadingDate: new Date(values.currentReadingDate),
	};
	const items: BatchItem[] = [];

	if (values.electricity) {
		const { isPaid: _, ...elec } = values.electricity;
		items.push({
			utilityType: "electricity" as const,
			...shared,
			...elec,
			ratePerUnit: toPaise(elec.ratePerUnit),
			fixedCharge: toPaise(elec.fixedCharge),
		});
	}
	if (values.water) {
		const { isPaid: _, ...water } = values.water;
		items.push({
			utilityType: "water" as const,
			...shared,
			previousReading: 0,
			currentReading: 0,
			...water,
			fixedCharge: toPaise(water.fixedCharge),
		});
	}
	if (values.maintenance) {
		const { isPaid: _, ...maint } = values.maintenance;
		items.push({
			utilityType: "maintenance" as const,
			...shared,
			previousReading: 0,
			currentReading: 0,
			...maint,
			fixedCharge: toPaise(maint.fixedCharge),
		});
	}
	return items;
}

//  Utility type config ***********

const UTILITY_CONFIG = {
	electricity: {
		Icon: IconBolt,
		iconBg: "bg-amber-100 text-amber-600",
		label: "Electricity",
	},
	water: {
		Icon: IconDroplet,
		iconBg: "bg-blue-100 text-blue-600",
		label: "Water",
	},
	maintenance: {
		Icon: IconTool,
		iconBg: "bg-slate-100 text-slate-600",
		label: "Maintenance",
	},
} as const;

//  WhatsApp message **************

function buildUtilityWaMessage(u: UtilityListItem, name: string): string {
	const month = new Date(u.currentReadingDate).toLocaleDateString("en-IN", {
		month: "long",
		year: "numeric",
	});
	if (u.utilityType === "electricity") {
		return [
			`Dear ${name},`,
			"",
			`Electricity bill — ${month}:`,
			`• ${u.previousReading} kWh → ${u.currentReading} kWh (${u.unitsUsed} kWh used)`,
			`• Rate: ${formatRupees(u.ratePerUnit ?? RATEPERUNIT)}/kWh`,
			`• Amount Due: ${formatRupees(u.totalAmount)}`,
		].join("\n");
	}
	const label = UTILITY_CONFIG[u.utilityType]?.label ?? u.utilityType;
	return [
		`Dear ${name},`,
		"",
		`${label} bill — ${month}: ${formatRupees(u.totalAmount)}`,
	].join("\n");
}

// Single pricing truth for rows + totals: total is immutable, credits are
// negative discounts, billed ignores payments, due includes them.
function getPricing(u: UtilityListItem) {
	const creditsSum = (u.credits ?? []).reduce((s, c) => s + c.amount, 0);
	const billed = u.totalAmount + creditsSum;
	const due = u.amountDue ?? billed;
	return { creditsSum, billed, due, hasDiscount: creditsSum < 0 };
}

// Design C: typographic hierarchy, no pills. Original = semibold muted with
// strikethrough, new = bold foreground. One component for both row variants.
function AmountCell({
	utility: u,
	label,
}: {
	utility: UtilityListItem;
	label: string;
}) {
	const { creditsSum, billed, due, hasDiscount } = getPricing(u);
	const creditTitle = (u.credits ?? [])
		.map((c) => `${c.creditNoteNo}: ${c.reason}`)
		.join(", ");
	return (
		<div>
			<p className="text-sm">
				{hasDiscount && (
					<del
						title={creditTitle || undefined}
						className="mr-2 font-semibold text-muted-foreground"
					>
						{formatRupees(u.totalAmount)}
					</del>
				)}
				<span className="font-bold text-foreground">
					{formatRupees(billed)}
				</span>
			</p>
			{hasDiscount && (
				<p
					title={creditTitle || undefined}
					className="text-muted-foreground text-xs"
				>
					Discount {formatRupees(creditsSum)}
					{due !== billed && <> · Due {formatRupees(due)}</>}
				</p>
			)}
			{!hasDiscount && due !== u.totalAmount && (
				<p className="text-muted-foreground text-xs">
					Due: {formatRupees(due)}
				</p>
			)}
			<p className="text-muted-foreground text-xs">{label}</p>
		</div>
	);
}

//  Utility row ***********

function UtilityRow({
	utility: u,
	tenantName,
	tenantPhone,
}: {
	utility: UtilityListItem;
	tenantName: string;
	tenantPhone: string | null | undefined;
}) {
	const config = UTILITY_CONFIG[u.utilityType] ?? UTILITY_CONFIG.maintenance;
	const { Icon, iconBg, label } = config;
	const isElectricity = u.utilityType === "electricity";

	const monthLabel = new Date(u.currentReadingDate).toLocaleDateString(
		"en-IN",
		{
			month: "long",
			year: "numeric",
		},
	);

	const prevDateLabel = new Date(
		u.previousReadingDate ?? u.currentReadingDate,
	).toLocaleDateString("en-IN", { day: "numeric", month: "short" });

	const currDateLabel = new Date(u.currentReadingDate).toLocaleDateString(
		"en-IN",
		{ day: "numeric", month: "short" },
	);

	const { creditsSum, billed, hasDiscount } = getPricing(u);

	return (
		<div className="flex items-center gap-4 py-4">
			<div
				className={`flex size-10 shrink-0 items-center justify-center rounded-full ${iconBg}`}
			>
				<Icon className="size-5" />
			</div>

			<div className="min-w-0 flex-1">
				<p className="font-medium text-sm">
					{label} · {monthLabel}
				</p>
				<p className="text-muted-foreground text-xs">
					{isElectricity
						? `Prev: ${u.previousReading} kWh (${prevDateLabel}) → Current: ${u.currentReading} kWh (${currDateLabel})`
						: "Flat charge"}
				</p>
				{isElectricity && hasDiscount && (
					<p className="mt-0.5 text-xs sm:hidden">
						<del className="font-semibold text-muted-foreground">
							{formatRupees(u.totalAmount)}
						</del>{" "}
						<span className="font-bold text-foreground">
							{formatRupees(billed)}
						</span>
						<span className="text-muted-foreground">
							{" "}
							({formatRupees(creditsSum)})
						</span>
					</p>
				)}
			</div>

			{isElectricity ? (
				<div className="hidden shrink-0 gap-8 text-right sm:flex">
					<div>
						<p className="font-semibold text-primary text-sm">
							{u.unitsUsed} kWh
						</p>
						<p className="text-muted-foreground text-xs">Units Used</p>
					</div>
					<div>
						<p className="font-medium text-sm">
							{formatRupees(u.ratePerUnit ?? RATEPERUNIT)}/kWh
						</p>
						<p className="text-muted-foreground text-xs">Rate</p>
					</div>
					<div>
						<AmountCell utility={u} label="Bill Amount" />
					</div>
				</div>
			) : (
				<div className="shrink-0 text-right">
					<AmountCell utility={u} label="Amount" />
				</div>
			)}

			<Button
				variant="outline"
				size="sm"
				disabled={!tenantPhone}
				title={tenantPhone ? "Send WhatsApp receipt" : "No phone on file"}
				className="shrink-0 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
				onClick={() => {
					if (!tenantPhone) return;
					const phone = tenantPhone.replace(/\D/g, "");
					window.open(
						`https://wa.me/${phone}?text=${encodeURIComponent(buildUtilityWaMessage(u, tenantName))}`,
						"_blank",
					);
				}}
			>
				WA
			</Button>
		</div>
	);
}

//  Add Reading button ***********

function AddReadingButton({ leaseId }: { leaseId: string }) {
	const [open, setOpen] = useState(false);
	const createBatch = useOptimisticCreateBatchUtility();

	function handleSubmit(values: UtilityBatchFormValues) {
		const items = buildBatchItems(values);
		createBatch.mutate(
			{ leaseId: values.leaseId, batchId: values.batchId, items },
			{ onSuccess: () => setOpen(false) },
		);
	}

	return (
		<>
			<Button onClick={() => setOpen(true)}>
				<IconPlus className="mr-1.5 size-4" />
				Add Reading
			</Button>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-lg">
					<DialogHeader>
						<DialogTitle>Add Utility Reading</DialogTitle>
					</DialogHeader>
					{/* WHY key: UtilityForm uses `defaultValues` (not `values`), so it
					    won't reset between opens unless we remount it. */}
					<UtilityForm
						key={open ? "open" : "closed"}
						leaseId={leaseId}
						onSubmit={handleSubmit}
						isSubmitting={createBatch.isPending}
					/>
				</DialogContent>
			</Dialog>
		</>
	);
}

// **** Tab *************

interface UtilitiesTabProps {
	tenant: TenantDetail;
	utilities: UtilityListItem[];
	leaseId: string;
}

export function UtilitiesTab({
	tenant,
	utilities,
	leaseId,
}: UtilitiesTabProps) {
	const sorted = [...utilities].sort(
		(a, b) =>
			new Date(b.currentReadingDate).getTime() -
			new Date(a.currentReadingDate).getTime(),
	);
	const totals = useMemo(() => {
		let billed = 0;
		let discount = 0;
		let due = 0;
		for (const u of utilities) {
			const p = getPricing(u);
			billed += u.totalAmount;
			discount += p.creditsSum;
			due += p.due;
		}
		return { billed, due, discount };
	}, [utilities]);

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<h3 className="font-semibold text-base">Utility History</h3>
				{leaseId && <AddReadingButton leaseId={leaseId} />}
			</div>

			<div className="mb-4 grid grid-cols-3 divide-x rounded-xl border bg-card text-sm">
				<div className="p-4">
					<p className="text-muted-foreground text-xs">Total billed (all)</p>
					<p className="mt-1 font-bold text-foreground text-xl tracking-tight">
						{formatRupees(totals.billed)}
					</p>
				</div>
				<div className="p-4">
					<p className="text-muted-foreground text-xs">Discounts (all)</p>
					<p className="mt-1 font-bold text-foreground text-xl tracking-tight">
						{totals.discount < 0 ? formatRupees(totals.discount) : "—"}
					</p>
				</div>
				<div className="p-4">
					<p className="text-muted-foreground text-xs">Amount due (all)</p>
					<p className="mt-1 font-bold text-foreground text-xl tracking-tight">
						{formatRupees(totals.due)}
					</p>
				</div>
			</div>

			{sorted.length === 0 ? (
				<div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground text-sm">
					No utility readings recorded yet.
				</div>
			) : (
				<div className="divide-y">
					{sorted.map((u) => (
						<UtilityRow
							key={u.id}
							utility={u}
							tenantName={tenant.name}
							tenantPhone={tenant.phone}
						/>
					))}
				</div>
			)}
		</div>
	);
}
