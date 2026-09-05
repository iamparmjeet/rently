"use client";

import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import { LogoIcon } from "@rently/ui/shared/logo";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageLoader } from "@rently/ui/shared/page-loader";
import { IconArrowLeft, IconPrinter } from "@tabler/icons-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef } from "react";
import { useUtilities } from "@/hooks/utilities";
import {
	getUtilityBillChargeLines,
	getUtilityBillNumber,
} from "@/lib/utility-bill";
import { getUtilityBillPaymentState } from "@/lib/utility-bill-payment-state";

function formatDate(value: Date) {
	return new Intl.DateTimeFormat("en-IN", {
		day: "2-digit",
		month: "long",
		timeZone: "Asia/Kolkata",
		year: "numeric",
	}).format(new Date(value));
}

function getCombinedBillNumber(ids: string[]) {
	if (ids.length === 0) return "KQ-CMB-UNKNOWN";
	const base = ids[0] ?? "";
	return `KQ-CMB-${base.replaceAll("-", "").slice(-12).toUpperCase()}`;
}

function CombinedBillContent() {
	const searchParams = useSearchParams();
	const { data: utilData, isLoading } = useUtilities();
	const idsParam = searchParams.get("ids");
	const rentParam = searchParams.get("rent");
	const shouldPrint = searchParams.get("print") === "true";
	const ids = idsParam ? idsParam.split(",").filter(Boolean) : [];
	const rent = rentParam ? Number.parseInt(rentParam, 10) : 0;
	const printed = useRef(false);

	const allUtilities = utilData?.utilities ?? [];
	const items = ids.length
		? allUtilities.filter((u) => ids.includes(u.id))
		: [];

	useEffect(() => {
		if (!ids.length || items.length === 0) return;
		const billNo = getCombinedBillNumber(ids);
		const prev = document.title;
		document.title = `${billNo} · Combined Bill · KeyHQ`;
		return () => {
			document.title = prev;
		};
	}, [ids, items.length]);

	useEffect(() => {
		printed.current = false;
	}, [idsParam]);

	useEffect(() => {
		if (!shouldPrint || items.length === 0 || printed.current) return;
		printed.current = true;
		let cancelled = false;
		const doPrint = async () => {
			try {
				if (document.fonts?.ready) await document.fonts.ready;
			} catch {}
			if (cancelled) return;
			window.requestAnimationFrame(() => {
				if (!cancelled) window.print();
			});
		};
		const timer = window.setTimeout(doPrint, 100);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [shouldPrint, items.length]);

	if (isLoading) return <PageLoader rows={2} />;
	if (!idsParam || items.length === 0) {
		return (
			<NotFoundState message="Combined bill not found. Missing utilities for this bill." />
		);
	}

	const first = items[0]!;
	const billNumber = getCombinedBillNumber(ids);
	const periodStart = first.previousReadingDate ?? first.currentReadingDate;
	const periodEnd = first.currentReadingDate;
	const days = Math.max(
		0,
		Math.round(
			(new Date(periodEnd).getTime() - new Date(periodStart).getTime()) /
				(1000 * 60 * 60 * 24),
		),
	);
	const isLongArrears = days > 60;
	const rentMonthLabel = new Intl.DateTimeFormat("en-IN", {
		month: "long",
		year: "numeric",
	}).format(new Date(periodEnd));
	const rentPeriodStart = new Date(
		new Date(periodEnd).getFullYear(),
		new Date(periodEnd).getMonth(),
		1,
	);
	const rentPeriodEnd = new Date(
		new Date(periodEnd).getFullYear(),
		new Date(periodEnd).getMonth() + 1,
		0,
	);
	const rentPeriodLabel =
		rentPeriodStart.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
		}) +
		" – " +
		rentPeriodEnd.toLocaleDateString("en-IN", {
			day: "2-digit",
			month: "short",
			year: "numeric",
		});

	const getDue = (u: (typeof items)[number]) =>
		(u as { amountDue?: number }).amountDue ?? u.totalAmount;

	const utilityTotalDue = items.reduce((s, u) => s + Math.max(0, getDue(u)), 0);
	const utilityOriginalTotal = items.reduce((s, u) => s + u.totalAmount, 0);
	const statementTotal = utilityTotalDue + rent;
	const originalStatementTotal = utilityOriginalTotal + rent;
	const hasAnyDiscount = items.some((u) =>
		(u.credits ?? []).some((credit) => credit.type === "discount"),
	);
	const allPaid = items.every((u) => getDue(u) <= 0);
	const billedToName = first.tenantName ?? "Tenant";
	const propertyLabel = `${first.propertyName} · Unit ${first.unitNumber}`;

	const paymentState = getUtilityBillPaymentState({
		amountDue: statementTotal,
		hasPaymentReceipt: false,
		isPaid: allPaid && statementTotal <= 0,
	});

	return (
		<main className="combined-bill-page min-h-screen bg-slate-100 px-4 py-6 sm:px-8 sm:py-10">
			<style>{`
				@page {
					size: A4;
					margin: 12mm;
				}

				@media print {
					body:has(.combined-bill-page) [data-sidebar="sidebar"],
					body:has(.combined-bill-page) [data-dashboard-header],
					body:has(.combined-bill-page) .combined-bill-screen-only {
						display: none !important;
					}

					body:has(.combined-bill-page) main {
						min-height: 0 !important;
						padding: 0 !important;
					}

					.combined-bill {
						max-width: none !important;
						padding: 0 !important;
						box-shadow: none !important;
					}

					.combined-bill .keyhq-logo-piece {
						animation: none !important;
						transform: none !important;
					}
				}
			`}</style>

			<nav
				aria-label="Combined bill actions"
				className="combined-bill-screen-only mx-auto mb-4 flex w-full max-w-210 flex-wrap items-center justify-between gap-3"
			>
				<Button variant="outline" render={<Link href="/utilities" />}>
					<IconArrowLeft className="size-4" />
					Back to utilities
				</Button>
				<Button onClick={() => window.print()}>
					<IconPrinter className="size-4" />
					Print / Save PDF
				</Button>
			</nav>

			<article className="combined-bill mx-auto w-full max-w-210 bg-white p-5 text-slate-900 shadow-sm sm:p-10">
				<header className="flex flex-col gap-6 border-slate-900 border-b-2 pb-6 sm:flex-row sm:items-start sm:justify-between">
					<div>
						<div className="flex items-center gap-2">
							<LogoIcon aria-hidden="true" className="size-8.5 shrink-0" />
							<p className="font-bold text-xl tracking-tight">KeyHQ</p>
						</div>
						<p className="mt-1 text-slate-500 text-sm">
							Property Management Simplified
						</p>
					</div>
					<div className="sm:text-right">
						<p
							className={`mb-2 inline-flex rounded-full px-2.5 py-1 font-bold text-[10px] uppercase tracking-wider ${
								statementTotal <= 0
									? "bg-emerald-50 text-emerald-700"
									: "bg-amber-50 text-amber-700"
							}`}
						>
							{paymentState.statusLabel}
						</p>
						<h1 className="font-extrabold text-2xl tracking-tight">
							Combined bill
						</h1>
						<p className="mt-2 font-mono text-slate-600 text-xs">
							Bill no. {billNumber}
						</p>
						{hasAnyDiscount ? (
							<p className="mt-1 text-slate-500 text-xs line-through">
								Original {formatRupees(originalStatementTotal)}
							</p>
						) : null}
					</div>
				</header>

				<section className="grid gap-6 border-slate-200 border-b py-6 sm:grid-cols-2">
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Billed to
						</p>
						<p className="mt-2 font-bold text-base">{billedToName}</p>
						<p className="mt-1 text-slate-700 text-sm">{propertyLabel}</p>
					</div>
					<div className="sm:text-right">
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Service location
						</p>
						<p className="mt-2 font-bold text-base">{first.propertyName}</p>
						<p className="mt-1 text-slate-500 text-sm">
							Unit {first.unitNumber}
						</p>
						<p className="mt-1 text-slate-500 text-xs">
							{items.length} {items.length === 1 ? "utility" : "utilities"} •
							Rent + utilities
						</p>
					</div>
				</section>

				<section
					aria-label="Bill information"
					className="grid gap-4 border-slate-200 border-b py-5 sm:grid-cols-3"
				>
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Billing period
						</p>
						<p className="mt-1 font-medium text-sm">
							{formatDate(periodStart)} – {formatDate(periodEnd)}
						</p>
						<p className="mt-1 text-slate-500 text-xs">
							{days} days{" "}
							{isLongArrears ? `• Rent: ${rentMonthLabel} only` : ""}
						</p>
						{isLongArrears ? (
							<p className="mt-1 text-[11px] text-amber-600">
								Utility arrears — rent shown is 1 month only
							</p>
						) : null}
					</div>
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Rent period
						</p>
						<p className="mt-1 font-medium text-sm">{rentPeriodLabel}</p>
						<p className="mt-1 text-slate-500 text-xs">
							Monthly rent for this unit
						</p>
					</div>
					<div className="sm:text-right">
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Issue date
						</p>
						<p className="mt-1 font-medium text-sm">
							{formatDate(first.createdAt)}
						</p>
					</div>
				</section>

				{/* Rent breakdown */}
				<section className="py-6">
					<div className="overflow-hidden rounded-lg border border-slate-200">
						<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-slate-50 px-4 py-3 font-semibold text-xs uppercase tracking-wide">
							<span>Charge details</span>
							<span>Amount</span>
						</div>
						<div className="divide-y divide-slate-200 px-4">
							<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4">
								<div className="min-w-0">
									<p className="font-semibold text-sm">Rent</p>
									<p className="mt-1 text-slate-600 text-sm">
										{rentPeriodLabel} • {rentMonthLabel}
									</p>
								</div>
								<p className="font-bold text-base tabular-nums">
									{formatRupees(rent)}
								</p>
							</div>
							{items.flatMap((u) => {
								const lines = getUtilityBillChargeLines({
									utilityType: u.utilityType,
									unitsUsed: u.unitsUsed ?? null,
									ratePerUnit: u.ratePerUnit ?? null,
									fixedCharge: u.fixedCharge ?? null,
									totalAmount: u.totalAmount,
									description: u.description,
									credits: u.credits ?? null,
								} as never);
								const billNo = getUtilityBillNumber(u.id);
								return lines.map((line) => (
									<div
										key={`${u.id}-${line.label}`}
										className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4"
									>
										<div className="min-w-0">
											<p className="font-semibold text-sm capitalize">
												{line.label}
											</p>
											<p className="mt-1 text-slate-600 text-xs">
												{line.detail ? `${line.detail} • ${billNo}` : billNo}
											</p>
										</div>
										<p className="font-bold text-base tabular-nums">
											{formatRupees(line.amount)}
										</p>
									</div>
								));
							})}
						</div>
					</div>
				</section>

				<footer className="rounded-lg border-2 border-slate-900 bg-slate-50 p-4 sm:p-5">
					<div className="flex items-end justify-between gap-4">
						<div>
							<p className="font-semibold text-slate-500 text-xs uppercase tracking-wide">
								{paymentState.amountLabel}
							</p>
							<p className="mt-1 font-semibold text-sm">
								{paymentState.statusLabel}
							</p>
							{hasAnyDiscount ? (
								<p className="mt-1 text-slate-500 text-xs line-through">
									Original {formatRupees(originalStatementTotal)}
								</p>
							) : null}
							<p className="mt-1 text-slate-500 text-xs">
								Rent {formatRupees(rent)} + Utilities{" "}
								{formatRupees(utilityTotalDue)}
							</p>
						</div>
						<p className="font-extrabold text-2xl tabular-nums sm:text-3xl">
							{formatRupees(statementTotal)}
						</p>
					</div>
					<p className="mt-4 border-slate-200 border-t pt-3 text-slate-500 text-xs">
						{isLongArrears
							? `This bill includes ${days}-day utility arrears. Rent is for ${rentMonthLabel} only.`
							: "Rent and utility charges for this billing period."}
					</p>
				</footer>
			</article>
		</main>
	);
}

export default function CombinedBillPage() {
	return (
		<Suspense fallback={<PageLoader rows={2} />}>
			<CombinedBillContent />
		</Suspense>
	);
}
