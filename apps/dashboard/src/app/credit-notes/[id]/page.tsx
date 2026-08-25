"use client";

import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import { LogoIcon } from "@rently/ui/shared/logo";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageLoader } from "@rently/ui/shared/page-loader";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useRef } from "react";
import { useCreditNote } from "@/hooks/credit";
import { getUtilityBillNumber } from "@/lib/utility-bill";

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-IN", {
		day: "2-digit",
		month: "long",
		timeZone: "Asia/Kolkata",
		year: "numeric",
	}).format(new Date(value));
}

export default function CreditNotePage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const searchParams = useSearchParams();
	const { data, isLoading, isError } = useCreditNote(id);
	const printed = useRef(false);
	const shouldPrint = searchParams.get("print") === "true";
	const note = data?.creditNote;
	const billNumber = note?.utility
		? getUtilityBillNumber(note.utility.id)
		: null;

	useEffect(() => {
		if (!note) return;
		const prev = document.title;
		document.title = `${note.credit.creditNoteNo} · KeyHQ Credit Note`;
		return () => {
			document.title = prev;
		};
	}, [note]);

	useEffect(() => {
		if (!shouldPrint || !note || printed.current) return;
		printed.current = true;
		const t = window.setTimeout(() => window.print(), 0);
		return () => window.clearTimeout(t);
	}, [shouldPrint, note]);

	if (isLoading) return <PageLoader rows={2} />;
	if (isError || !note)
		return <NotFoundState message="Credit note not found." />;

	const isUtility = !!note.utility;
	const originalTotal = isUtility
		? (note.utility?.totalAmount ?? 0)
		: note.lease.rent;
	const adjustedTotal = originalTotal + note.credit.amount; // amount is negative
	const issuerName = note.owner.companyName?.trim() || note.owner.name;
	const gstEnabled = note.owner.gstEnabled;
	const hsn = isUtility
		? note.utility?.utilityType === "electricity"
			? "— (electricity 0% per owner config)"
			: note.utility?.utilityType === "maintenance"
				? `HSN 9972 · ${note.owner.gstRateMaintenance ?? 0}%`
				: "HSN — · 0%"
		: `HSN 9972 · ${note.owner.gstRateRent ?? 0}%`;

	return (
		<main className="credit-note-page min-h-screen bg-slate-100 px-4 py-6 sm:px-8 sm:py-10">
			<style>{`
				@page { size: A4; margin: 12mm; }
				@media print {
					body:has(.credit-note-page) [data-sidebar="sidebar"],
					body:has(.credit-note-page) [data-dashboard-header],
					body:has(.credit-note-page) .credit-note-screen-only { display: none !important; }
					body:has(.credit-note-page) main { min-height: 0 !important; padding: 0 !important; }
					.credit-note { max-width: none !important; padding: 0 !important; box-shadow: none !important; }
					.credit-note .keyhq-logo-piece { animation: none !important; transform: none !important; }
				}
			`}</style>

			<nav className="credit-note-screen-only mx-auto mb-4 flex w-full max-w-210 flex-wrap items-center justify-between gap-3">
				<Button variant="outline" render={<Link href="/utilities" />}>
					<IconArrowLeft className="size-4" /> Back to utilities
				</Button>
				<Button onClick={() => window.print()}>
					<IconPrinter className="size-4" /> Print / Save PDF
				</Button>
			</nav>

			<article className="credit-note mx-auto w-full max-w-210 bg-white p-5 text-slate-900 shadow-sm sm:p-10">
				<header className="flex flex-col gap-6 border-slate-900 border-b-2 pb-6 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<LogoIcon aria-hidden className="size-8.5 shrink-0" />
							<p className="font-bold text-xl tracking-tight">KeyHQ</p>
						</div>
						<p className="mt-1 text-slate-500 text-sm">
							Property Management Simplified
						</p>
						{note.owner.gstNumber ? (
							<p className="mt-1 text-slate-500 text-xs">
								GSTIN {note.owner.gstNumber}
							</p>
						) : null}
					</div>
					<div className="sm:text-right">
						<p className="mb-2 inline-flex rounded-full bg-amber-50 px-2.5 py-1 font-bold text-[10px] text-amber-700 uppercase tracking-wider">
							Credit note
						</p>
						<h1 className="font-extrabold text-2xl tracking-tight">
							Credit Note
						</h1>
						<p className="mt-2 font-mono text-slate-600 text-xs">
							No. {note.credit.creditNoteNo}
						</p>
						{billNumber ? (
							<p className="font-mono text-slate-500 text-xs">
								Against {billNumber}
							</p>
						) : null}
						{note.credit.reversedAt ? (
							<p className="mt-1 font-semibold text-red-600 text-xs">
								Reversed on {formatDate(note.credit.reversedAt)}
							</p>
						) : null}
					</div>
				</header>

				<section className="grid gap-6 border-slate-200 border-b py-6 sm:grid-cols-2">
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Credited to
						</p>
						<p className="mt-2 font-bold text-base">{note.tenant.name}</p>
						<p className="mt-1 text-slate-700 text-sm">
							{note.property.name} · Unit {note.unit.unitNumber}
						</p>
						<p className="mt-1 text-slate-500 text-sm">
							{note.property.address}
						</p>
					</div>
					<div className="sm:text-right">
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Issued by
						</p>
						<p className="mt-2 font-bold text-base">{issuerName}</p>
						{note.owner.companyName?.trim() ? (
							<p className="mt-1 text-slate-700 text-sm">{note.owner.name}</p>
						) : null}
						{note.owner.address ? (
							<p className="mt-1 text-slate-500 text-sm">
								{note.owner.address}
							</p>
						) : null}
						<p className="mt-1 text-slate-500 text-xs">
							GST {gstEnabled ? "enabled" : "not enabled"}{" "}
							{gstEnabled ? `· ${hsn}` : null}
						</p>
					</div>
				</section>

				<section className="grid gap-4 border-slate-200 border-b py-5 sm:grid-cols-3">
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Linked bill
						</p>
						<p className="mt-1 font-medium text-sm">
							{isUtility ? `Utility · ${note.utility?.utilityType}` : "Rent"}
						</p>
						{billNumber ? (
							<p className="mt-1 font-mono text-slate-500 text-xs">
								{billNumber}
							</p>
						) : null}
					</div>
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Credit date
						</p>
						<p className="mt-1 font-medium text-sm">
							{formatDate(note.credit.createdAt)}
						</p>
					</div>
					<div className="sm:text-right">
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Type
						</p>
						<p className="mt-1 font-medium text-sm capitalize">
							{note.credit.type.replaceAll("_", " ")} · {note.credit.appliedAs}
						</p>
					</div>
				</section>

				<section className="py-6">
					<div className="overflow-hidden rounded-lg border border-slate-200">
						<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-slate-50 px-4 py-3 font-semibold text-xs uppercase tracking-wide">
							<span>Details</span>
							<span>Amount</span>
						</div>
						<div className="divide-y divide-slate-200 px-4">
							<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4">
								<div>
									<p className="font-semibold text-sm">Original amount</p>
									<p className="mt-1 text-slate-600 text-sm">
										{isUtility ? "As per bill" : "Monthly rent"} ·{" "}
										{billNumber ?? note.lease.id.slice(0, 8)}
									</p>
								</div>
								<p className="font-bold text-base tabular-nums">
									{formatRupees(originalTotal)}
								</p>
							</div>
							<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4">
								<div>
									<p className="font-semibold text-sm capitalize">
										{note.credit.type === "write_off"
											? "Write-off"
											: note.credit.type === "credit_note"
												? "Credit note"
												: "Discount"}{" "}
										— {note.credit.reason}
									</p>
									<p className="mt-1 text-slate-600 text-sm">
										Credit Note {note.credit.creditNoteNo}
									</p>
								</div>
								<p className="font-bold text-base text-emerald-700 tabular-nums">
									{formatRupees(note.credit.amount)}
								</p>
							</div>
						</div>
					</div>
				</section>

				<footer className="rounded-lg border-2 border-slate-900 bg-slate-50 p-4 sm:p-5">
					<div className="flex items-end justify-between gap-4">
						<div>
							<p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
								Adjusted amount
							</p>
							<p className="mt-1 font-semibold text-sm">
								Original {formatRupees(originalTotal)} → Adjusted{" "}
								{formatRupees(adjustedTotal)}
							</p>
							<p className="mt-1 text-slate-500 text-xs">
								Reason: {note.credit.reason} · Min 10 chars enforced at API
							</p>
							<p className="mt-1 text-slate-500 text-xs">
								CA disclaimer: GST shown as configured. Residential rent
								typically 0% exempt — confirm HSN/rate with your CA.
							</p>
						</div>
						<p className="font-extrabold text-2xl tabular-nums sm:text-3xl">
							{formatRupees(adjustedTotal)}
						</p>
					</div>
				</footer>
			</article>
		</main>
	);
}
