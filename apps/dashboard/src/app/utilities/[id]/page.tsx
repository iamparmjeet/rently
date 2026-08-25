"use client";

import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import { LogoIcon } from "@rently/ui/shared/logo";
import { NotFoundState } from "@rently/ui/shared/not-found-state";
import { PageLoader } from "@rently/ui/shared/page-loader";
import { IconArrowLeft, IconPrinter, IconReceipt } from "@tabler/icons-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { use, useEffect, useRef } from "react";
import { useUtility } from "@/hooks/utilities";
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

export default function UtilityBillPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const searchParams = useSearchParams();
	const { data, isLoading, isError } = useUtility(id);
	const printed = useRef(false);
	const utility = data?.utility;
	const shouldPrint = searchParams.get("print") === "true";
	const billNumber = utility ? getUtilityBillNumber(utility.id) : null;

	useEffect(() => {
		if (!billNumber || !utility) return;

		const previousTitle = document.title;
		document.title = `${billNumber} · ${utility.tenantName} · KeyHQ`;
		return () => {
			document.title = previousTitle;
		};
	}, [billNumber, utility]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reset printed on id change
	useEffect(() => {
		printed.current = false;
	}, [id]);

	useEffect(() => {
		if (!shouldPrint || !utility || printed.current) return;

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
	}, [shouldPrint, utility]);

	if (isLoading) return <PageLoader rows={2} />;
	if (isError || !utility || !billNumber) {
		return <NotFoundState message="Utility bill not found or unavailable." />;
	}

	const readingPeriod = utility.previousReadingDate
		? `${formatDate(utility.previousReadingDate)} – ${formatDate(utility.currentReadingDate)}`
		: formatDate(utility.currentReadingDate);
	const credits = (
		utility as unknown as {
			credits?: {
				amount: number;
				reason: string;
				creditNoteNo: string;
				type?: string;
			}[];
			amountDue?: number;
		}
	).credits;
	const amountDue =
		(utility as unknown as { amountDue?: number }).amountDue ??
		(credits?.length
			? utility.totalAmount + credits.reduce((s, c) => s + c.amount, 0)
			: utility.isPaid
				? 0
				: utility.totalAmount);
	const paymentState = getUtilityBillPaymentState({
		amountDue,
		hasPaymentReceipt: utility.receiptPaymentId !== null,
		isPaid: utility.isPaid,
	});
	const chargeLines = getUtilityBillChargeLines({
		...utility,
		credits,
	} as never);
	const meterReading = `${Number(utility.previousReading ?? 0).toFixed(2)} → ${Number(
		utility.currentReading ?? 0,
	).toFixed(2)}`;
	const issuerName = utility.companyName?.trim() || utility.ownerName;
	const statusDescription = utility.receiptPaymentId
		? "Payment received. The payment receipt is available separately."
		: amountDue <= 0
			? "This bill was marked as paid without a recorded payment receipt."
			: "Payment is pending for this bill.";

	return (
		<main className="utility-bill-page min-h-screen bg-slate-100 px-4 py-6 sm:px-8 sm:py-10">
			<style>{`
				@page {
					size: A4;
					margin: 12mm;
				}

				@media print {
					body:has(.utility-bill-page) [data-sidebar="sidebar"],
					body:has(.utility-bill-page) [data-dashboard-header],
					body:has(.utility-bill-page) .utility-bill-screen-only {
						display: none !important;
					}

					body:has(.utility-bill-page) main {
						min-height: 0 !important;
						padding: 0 !important;
					}

					.utility-bill {
						max-width: none !important;
						padding: 0 !important;
						box-shadow: none !important;
					}

					.utility-bill .keyhq-logo-piece {
						animation: none !important;
						transform: none !important;
					}
				}
			`}</style>

			<nav
				aria-label="Utility bill actions"
				className="utility-bill-screen-only mx-auto mb-4 flex w-full max-w-210 flex-wrap items-center justify-between gap-3"
			>
				<Button variant="outline" render={<Link href="/utilities" />}>
					<IconArrowLeft className="size-4" />
					Back to utilities
				</Button>
				<div className="flex flex-wrap items-center justify-end gap-2">
					{utility.receiptPaymentId ? (
						<Button
							variant="outline"
							render={<Link href={`/receipts/${utility.receiptPaymentId}`} />}
						>
							<IconReceipt className="size-4" />
							View receipt
						</Button>
					) : null}
					<Button onClick={() => window.print()}>
						<IconPrinter className="size-4" />
						Print / Save PDF
					</Button>
				</div>
			</nav>

			<article className="utility-bill mx-auto w-full max-w-210 bg-white p-5 text-slate-900 shadow-sm sm:p-10">
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
								amountDue <= 0
									? "bg-emerald-50 text-emerald-700"
									: "bg-amber-50 text-amber-700"
							}`}
						>
							{paymentState.statusLabel}
						</p>
						<h1 className="font-extrabold text-2xl tracking-tight">
							Utility bill
						</h1>
						<p className="mt-2 font-mono text-slate-600 text-xs">
							Bill no. {billNumber}
						</p>
					</div>
				</header>

				<section className="grid gap-6 border-slate-200 border-b py-6 sm:grid-cols-2">
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Billed to
						</p>
						<p className="mt-2 font-bold text-base">{utility.tenantName}</p>
						<p className="mt-1 text-slate-700 text-sm">
							{utility.propertyName} · Unit {utility.unitNumber}
						</p>
						<p className="mt-1 text-slate-500 text-sm">
							{utility.propertyAddress}
						</p>
					</div>
					<div className="sm:text-right">
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Issued by
						</p>
						<p className="mt-2 font-bold text-base">{issuerName}</p>
						{utility.companyName?.trim() ? (
							<p className="mt-1 text-slate-700 text-sm">{utility.ownerName}</p>
						) : null}
						{utility.ownerAddress ? (
							<p className="mt-1 text-slate-500 text-sm">
								{utility.ownerAddress}
							</p>
						) : null}
						{utility.gstNumber ? (
							<p className="mt-1 text-slate-500 text-xs">
								GSTIN {utility.gstNumber}
							</p>
						) : null}
					</div>
				</section>

				<section
					aria-label="Bill information"
					className="grid gap-4 border-slate-200 border-b py-5 sm:grid-cols-3"
				>
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Utility
						</p>
						<p className="mt-1 font-medium text-sm capitalize">
							{utility.utilityType}
						</p>
					</div>
					<div>
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Billing period
						</p>
						<p className="mt-1 font-medium text-sm">{readingPeriod}</p>
					</div>
					<div className="sm:text-right">
						<p className="font-semibold text-[10px] text-slate-500 uppercase tracking-[0.14em]">
							Issue date
						</p>
						<p className="mt-1 font-medium text-sm">
							{formatDate(utility.createdAt)}
						</p>
					</div>
				</section>

				<section className="py-6">
					<div className="overflow-hidden rounded-lg border border-slate-200">
						<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 bg-slate-50 px-4 py-3 font-semibold text-xs uppercase tracking-wide">
							<span>Charge details</span>
							<span>Amount</span>
						</div>
						<div className="divide-y divide-slate-200 px-4">
							{chargeLines.map((line) => (
								<div
									key={line.label}
									className="grid grid-cols-[minmax(0,1fr)_auto] gap-4 py-4"
								>
									<div className="min-w-0">
										<p className="font-semibold text-sm capitalize">
											{line.label}
										</p>
										{line.detail ? (
											<p className="mt-1 text-slate-600 text-sm">
												{line.label === "Electricity usage"
													? `${meterReading} = ${line.detail} × ${formatRupees(utility.ratePerUnit ?? 0)}/unit`
													: line.label === "Electricity"
														? `${meterReading} · ${line.detail}`
														: line.detail}
											</p>
										) : null}
									</div>
									<p className="font-bold text-base tabular-nums">
										{formatRupees(line.amount)}
									</p>
								</div>
							))}
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
							{credits?.length ? (
								<p className="mt-1 text-slate-500 text-xs line-through">
									Original {formatRupees(utility.totalAmount)}
								</p>
							) : null}
						</div>
						<p className="font-extrabold text-2xl tabular-nums sm:text-3xl">
							{formatRupees(amountDue)}
						</p>
					</div>
					<p className="mt-4 border-slate-200 border-t pt-3 text-slate-500 text-xs">
						{statusDescription}
					</p>
				</footer>
			</article>
		</main>
	);
}
