"use client";

import { CREDIT_TYPES } from "@rently/db/constants/payment-constants";
import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { formatRupees } from "@rently/ui/lib/currency";
import type { DateRange } from "@rently/ui/lib/date";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { PageHeader } from "@rently/ui/shared/page-header";
import { PageLoader } from "@rently/ui/shared/page-loader";
import type { PaymentListItem } from "@rently/validators";
import {
	IconArrowsSort,
	IconBrandWhatsapp,
	IconChartBar,
	IconChevronDown,
	IconDownload,
	IconLayoutGrid,
	IconList,
	IconMail,
	IconReceipt,
	IconRefreshAlert,
	IconSearch,
	IconTag,
} from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { AddAgreementPaymentButton } from "@/components/features/payments/add-agreement-payment-button";
import { AddPaymentButton } from "@/components/features/payments/add-payment-button";
import { PaymentExportDialog } from "@/components/features/payments/payment-export-dialog";
import { PaymentGrid } from "@/components/features/payments/payment-grid";
import { getTypeConfig } from "@/components/features/payments/payment-helpers";
import { Container } from "@/components/shared/container";
import { useCredits } from "@/hooks/credit";
import {
	useDeletePayment,
	useOwnerPaymentExport,
	usePayments,
	useSendPaymentReceipt,
	useVoidPaymentGroup,
} from "@/hooks/payments";
import { getCollectionHealth } from "@/lib/payment-collection-health";

// ── Type config ───────

type PaymentSort =
	| "payment-date-desc"
	| "payment-date-asc"
	| "recorded-date-desc"
	| "recorded-date-asc";

const PAYMENT_SORT_LABELS: Record<PaymentSort, string> = {
	"payment-date-desc": "Newest payment",
	"payment-date-asc": "Oldest payment",
	"recorded-date-desc": "Recently recorded",
	"recorded-date-asc": "First recorded",
};

function fmtDate(
	date: Date | string,
	opts: Intl.DateTimeFormatOptions = {
		day: "2-digit",
		month: "short",
		year: "numeric",
	},
) {
	return new Date(date).toLocaleDateString("en-IN", opts);
}

function PaymentMetric({
	icon: Icon,
	label,
	value,
}: {
	icon: typeof IconChartBar;
	label: string;
	value: string | number;
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

// ── WhatsApp message builder ───
//  pure function, no side effects — easy to test, easy to modify.
//  Builds the pre-composed message that WhatsApp pre-fills in the chat.
function buildWhatsAppMessage(payment: PaymentListItem): string {
	const name = payment.tenantName ?? "Tenant";
	const type = payment.type.charAt(0).toUpperCase() + payment.type.slice(1);
	const method = payment.paymentMethods?.replace("_", " ") ?? "—";
	const ref = payment.referenceNumber ?? "—";
	const date = fmtDate(payment.paymentDate, {
		day: "2-digit",
		month: "long",
		year: "numeric",
	});

	return [
		`Dear ${name},`,
		"",
		"Payment receipt:",
		`• Type   : ${type}`,
		`• Amount : ${formatRupees(payment.amount)}`,
		`• Date   : ${date}`,
		`• Method : ${method}`,
		`• Ref #  : ${ref}`,
		"",
		"Thank you for your payment.",
		"– KeyHQ",
	].join("\n");
}

// ── Detail dialog ─────

function DetailField({ label, value }: { label: string; value: string }) {
	return (
		<div className="flex flex-col gap-0.5">
			<span className="font-semibold text-[11px] text-muted-foreground uppercase tracking-wide">
				{label}
			</span>
			<span className="font-medium text-sm">{value}</span>
		</div>
	);
}

function PaymentDetailDialog({
	payment,
	open,
	onClose,
}: {
	payment: PaymentListItem | null;
	open: boolean;
	onClose: () => void;
}) {
	const sendReceipt = useSendPaymentReceipt();

	if (!payment) return null;

	const paymentId = payment.id;
	const config = getTypeConfig(payment.type);
	// reversals are system records — sending a receipt for a void/reversal
	// would confuse the tenant ("you received ₹-20,000?"). Both action
	// buttons are disabled for reversals.
	const isReversal = payment.type === PAYMENT_TYPES.REVERSAL;

	function handleWhatsApp() {
		if (!payment?.tenantPhone) return;
		// Strips all non-digit chars (spaces, dashes, +91 prefix formatting)
		// then opens wa.me which WhatsApp recognises as a deep link.
		const phone = payment.tenantPhone.replace(/\D/g, "");
		const msg = encodeURIComponent(buildWhatsAppMessage(payment));
		window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
	}

	function handleSendEmail() {
		if (!payment) return;
		sendReceipt.mutate({ paymentId: payment.id });
	}

	function handleDownloadReceipt() {
		window.open(`/receipts/${paymentId}?print=true`, "_blank", "noopener");
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(o) => {
				if (!o) onClose();
			}}
		>
			<DialogContent
				className="gap-0 overflow-hidden rounded-xl p-0 sm:max-w-md"
				showCloseButton={false}
			>
				<DialogHeader className="relative flex flex-row items-center justify-between overflow-hidden bg-linear-to-br from-primary/12 via-primary/3 to-transparent px-5 py-4">
					<DialogTitle className="font-semibold text-sm">
						Payment details
					</DialogTitle>
					<Button
						variant="ghost"
						size="icon"
						className="size-7"
						onClick={onClose}
					>
						<span aria-hidden className="text-base leading-none">
							×
						</span>
						<span className="sr-only">Close</span>
					</Button>
				</DialogHeader>

				<div className="flex items-start justify-between px-5 py-5">
					<div className="flex items-center gap-3">
						<div
							className={`flex size-11 shrink-0 items-center justify-center rounded-xl font-bold text-base ${config.avatarBg} ${config.avatarText}`}
						>
							{payment.type.charAt(0).toUpperCase()}
						</div>
						<div>
							<p className="font-semibold text-sm">
								{payment.tenantName ?? config.label}
							</p>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{config.label} · Lease #
								{payment.leaseId.slice(0, 8).toUpperCase()}
							</p>
						</div>
					</div>

					<div className="text-right">
						<p
							className={`font-semibold text-2xl tabular-nums tracking-tight ${
								isReversal ? "text-destructive" : "text-foreground"
							}`}
						>
							{formatRupees(payment.amount)}
						</p>
						<Badge variant={config.badgeVariant} className="mt-1 capitalize">
							{payment.type}
						</Badge>
					</div>
				</div>

				<div className="mx-5 rounded-lg border bg-muted/15 p-4">
					<p className="mb-3 font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
						Payment record
					</p>
					<div className="grid grid-cols-2 gap-x-6 gap-y-4">
						<DetailField label="Payment Type" value={config.label} />
						<DetailField
							label="Payment Date"
							value={fmtDate(payment.paymentDate)}
						/>
						<DetailField
							label="Payment Mode"
							value={
								payment.paymentMethods
									? payment.paymentMethods.replace("_", " / ").toUpperCase()
									: "—"
							}
						/>
						<DetailField
							label="Lease ID"
							value={`#${payment.leaseId.slice(0, 8).toUpperCase()}`}
						/>
						{payment.referenceNumber && (
							<DetailField
								label="Reference #"
								value={payment.referenceNumber}
							/>
						)}
						{payment.description && (
							<div className="col-span-2">
								<DetailField label="Description" value={payment.description} />
							</div>
						)}
					</div>
				</div>

				{/* ── Footer actions ── */}
				<DialogFooter className="mt-5 flex-row gap-2 border-t bg-muted/12 px-5 py-3 sm:justify-between">
					<Button variant="outline" size="sm" onClick={onClose}>
						Close
					</Button>

					<div className="flex flex-wrap gap-2">
						<Button
							size="sm"
							variant="outline"
							className="gap-1.5"
							disabled={isReversal}
							onClick={handleDownloadReceipt}
							title={
								isReversal
									? "Cannot download a receipt for a reversal"
									: "Open a printable payment receipt"
							}
						>
							<IconDownload className="size-4" />
							Download
						</Button>

						{/* WhatsApp — client-side deep link, no server call */}
						{/* WHY: disabled when no phone is on file (tenantProfiles.phone is nullable) or for reversals (a void is not a receipt). */}
						<Button
							size="sm"
							variant="outline"
							className="gap-1.5 border-[#25D366]/40 text-[#25D366] hover:bg-[#25D366]/5 hover:text-[#25D366] disabled:opacity-40"
							disabled={!payment.tenantPhone || isReversal}
							onClick={handleWhatsApp}
							title={
								!payment.tenantPhone
									? "No phone number on file for this tenant"
									: isReversal
										? "Cannot send receipt for a reversal"
										: "Send receipt via WhatsApp"
							}
						>
							<IconBrandWhatsapp className="size-4" />
							WhatsApp
						</Button>

						{/* Email — calls sendPaymentReceipt procedure, pre-composed */}
						{/* no form needed — the receipt content is deterministic.
						     One click sends; toast handles feedback. */}
						<Button
							size="sm"
							className="gap-1.5"
							disabled={sendReceipt.isPending || isReversal}
							onClick={handleSendEmail}
							title={
								isReversal ? "Cannot send receipt for a reversal" : undefined
							}
						>
							<IconMail className="size-4" />
							{sendReceipt.isPending ? "Sending…" : "Send Receipt"}
						</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

// ── Page ──────────

export default function PaymentsPage() {
	const { data, isLoading } = usePayments();
	const { data: creditsData, isLoading: creditsLoading } = useCredits();
	const voidPayment = useDeletePayment();
	const voidPaymentGroup = useVoidPaymentGroup();
	const exportPayments = useOwnerPaymentExport();
	const [pageTab, setPageTab] = useState<"payments" | "adjustments">(
		"payments",
	);
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<PaymentSort>("payment-date-desc");
	const [viewMode, setViewMode] = useState<"cards" | "rows">("cards");
	const [voidingId, setVoidingId] = useState<string | null>(null);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [exportOpen, setExportOpen] = useState(false);
	const [adjSearch, setAdjSearch] = useState("");
	const [adjTypeFilter, setAdjTypeFilter] = useState<string>("all");

	const payments = data?.payments ?? [];

	const filtered = payments.filter((p) => {
		const matchType = typeFilter === "all" || p.type === typeFilter;
		const q = search.trim().toLowerCase();
		const matchSearch =
			q === "" ||
			(p.referenceNumber?.toLowerCase().includes(q) ?? false) ||
			p.leaseId.toLowerCase().includes(q) ||
			(p.description?.toLowerCase().includes(q) ?? false) ||
			(p.tenantName?.toLowerCase().includes(q) ?? false);
		return matchType && matchSearch;
	});

	const sortedPayments = [...filtered].sort((a, b) => {
		const paymentDateDifference =
			new Date(b.paymentDate).getTime() - new Date(a.paymentDate).getTime();
		const recordedDateDifference =
			new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
		const idDifference = b.id.localeCompare(a.id);

		switch (sort) {
			case "payment-date-asc":
				return (
					-paymentDateDifference || -recordedDateDifference || -idDifference
				);
			case "recorded-date-desc":
				return recordedDateDifference || paymentDateDifference || idDifference;
			case "recorded-date-asc":
				return (
					-recordedDateDifference || -paymentDateDifference || -idDifference
				);
			default:
				return paymentDateDifference || recordedDateDifference || idDifference;
		}
	});
	const activeSortLabel = PAYMENT_SORT_LABELS[sort];

	const allCredits = creditsData?.credits ?? [];
	const collectionHealth = useMemo(
		() =>
			getCollectionHealth({
				payments,
			}),
		[payments],
	);

	const allTimeCollection = useMemo(
		() =>
			getCollectionHealth({
				payments,
				scope: "all-time",
			}),
		[payments],
	);
	const netDiscountTotal = useMemo(
		() =>
			allCredits
				.filter((credit) => credit.type === CREDIT_TYPES.DISCOUNT)
				.reduce((total, credit) => total + credit.amount, 0),
		[allCredits],
	);

	const reversalCount = payments.filter(
		(p) => p.type === PAYMENT_TYPES.REVERSAL,
	).length;

	const selectedPayment = payments.find((p) => p.id === detailId) ?? null;

	// Adjustments: only after tenant paid (paid utility/rent exists)
	const settledCredits = useMemo(() => {
		const paidUtilityIds = new Set(
			payments
				.filter((p) => p.utilityId != null && p.type !== PAYMENT_TYPES.REVERSAL)
				.map((p) => p.utilityId as string),
		);
		const paidRentLeaseIds = new Set(
			payments
				.filter((p) => !p.utilityId && p.type === PAYMENT_TYPES.RENT)
				.map((p) => p.leaseId),
		);
		return allCredits.filter((c) => {
			if (c.utilityId) return paidUtilityIds.has(c.utilityId);
			return paidRentLeaseIds.has(c.leaseId);
		});
	}, [allCredits, payments]);

	const adjFiltered = useMemo(() => {
		const q = adjSearch.trim().toLowerCase();
		return settledCredits.filter((c) => {
			const typeOk = adjTypeFilter === "all" || c.type === adjTypeFilter;
			const searchOk =
				q === "" ||
				c.creditNoteNo.toLowerCase().includes(q) ||
				c.reason.toLowerCase().includes(q) ||
				c.leaseId.toLowerCase().includes(q);
			return typeOk && searchOk;
		});
	}, [settledCredits, adjSearch, adjTypeFilter]);

	const adjTotal = adjFiltered.reduce((s, c) => s + c.amount, 0);

	if (isLoading) return <PageLoader />;

	// CSV
	function handlePaymentExport(range: DateRange) {
		exportPayments.mutate(range, {
			onSuccess: (result) => {
				if (result.payments.length > 0) {
					setExportOpen(false);
				}
			},
		});
	}

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				{/* ── Header ── */}
				<PageHeader
					title="Payments"
					description="Track rent collections and payment history."
				>
					<Button
						type="button"
						variant="outline"
						className="gap-1.5"
						onClick={() => setExportOpen(true)}
					>
						<IconDownload className="size-4" />
						Export CSV
					</Button>
					<AddPaymentButton withIcon />
					<AddAgreementPaymentButton />
				</PageHeader>

				<PaymentExportDialog
					open={exportOpen}
					onOpenChange={setExportOpen}
					onExport={handlePaymentExport}
					isExporting={exportPayments.isPending}
				/>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="grid divide-y sm:grid-cols-[1.05fr_1fr] sm:divide-x sm:divide-y-0">
						<div className="relative overflow-hidden bg-linear-to-br from-primary/8 via-card to-card p-5">
							<div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/8 blur-2xl" />
							<div className="relative">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
									Collection health
								</p>
								<p className="mt-1 font-semibold text-3xl tabular-nums tracking-tight">
									{formatRupees(collectionHealth.amount)}
								</p>
								<p className="mt-2 text-muted-foreground text-xs">
									Collected this month · {collectionHealth.transactionCount}{" "}
									transaction
									{collectionHealth.transactionCount !== 1 ? "s" : ""}
								</p>
							</div>
						</div>
						<div className="grid grid-cols-2 divide-x sm:grid-cols-4">
							<PaymentMetric
								icon={IconChartBar}
								label="All time"
								value={formatRupees(allTimeCollection.amount)}
							/>
							<PaymentMetric
								icon={IconTag}
								label="Net discounts"
								value={formatRupees(-netDiscountTotal)}
							/>
							<PaymentMetric
								icon={IconRefreshAlert}
								label="Reversals"
								value={reversalCount}
							/>
							<PaymentMetric
								icon={IconReceipt}
								label="Records"
								value={payments.length}
							/>
						</div>
					</div>
				</section>

				{/* ── Tabs: Payments vs Adjustments (write-offs/discounts) ── */}
				<div
					role="tablist"
					aria-label="Payments vs adjustments"
					className="flex gap-1 rounded-lg border bg-muted/40 p-1"
				>
					<button
						type="button"
						role="tab"
						aria-selected={pageTab === "payments"}
						onClick={() => setPageTab("payments")}
						className={`flex items-center gap-1.5 rounded-md px-4 py-2 font-medium text-sm transition-all ${pageTab === "payments" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
					>
						<IconReceipt className="size-3.5" />
						Payments
						<span
							className={`rounded-full px-1.5 py-0.5 font-bold text-[10px] ${pageTab === "payments" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}
						>
							{payments.length}
						</span>
					</button>
					<button
						type="button"
						role="tab"
						aria-selected={pageTab === "adjustments"}
						onClick={() => setPageTab("adjustments")}
						className={`flex items-center gap-1.5 rounded-md px-4 py-2 font-medium text-sm transition-all ${pageTab === "adjustments" ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
					>
						<IconTag className="size-3.5" />
						Adjustments
						<span
							className={`rounded-full px-1.5 py-0.5 font-bold text-[10px] ${pageTab === "adjustments" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}`}
						>
							{settledCredits.length}
						</span>
					</button>
				</div>

				{pageTab === "payments" ? (
					<>
						{/* ── Filter bar ── */}
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative min-w-50 flex-1 sm:max-w-xs">
								<IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="search"
									placeholder="Search by reference or lease ID…"
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-9 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
								/>
							</div>

							<select
								value={typeFilter}
								onChange={(e) => setTypeFilter(e.target.value)}
								className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-foreground text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
								style={{
									backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
									backgroundRepeat: "no-repeat",
									backgroundPosition: "right 10px center",
								}}
							>
								<option value="all">All Types</option>
								{Object.values(PAYMENT_TYPES).map((t) => (
									<option key={t} value={t}>
										{t.charAt(0).toUpperCase() + t.slice(1)}
									</option>
								))}
							</select>

							<DropdownMenu>
								<DropdownMenuTrigger
									render={
										<button
											type="button"
											className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-foreground text-sm transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
										>
											<IconArrowsSort className="size-3.5 text-muted-foreground" />
											<span>{activeSortLabel}</span>
											<IconChevronDown className="size-3.5 text-muted-foreground" />
										</button>
									}
								/>
								<DropdownMenuContent align="start">
									{(Object.keys(PAYMENT_SORT_LABELS) as PaymentSort[]).map(
										(option) => (
											<DropdownMenuItem
												key={option}
												onClick={() => setSort(option)}
											>
												{PAYMENT_SORT_LABELS[option]}
												{sort === option && <span className="ml-auto">✓</span>}
											</DropdownMenuItem>
										),
									)}
								</DropdownMenuContent>
							</DropdownMenu>

							{(typeFilter !== "all" || search.trim() !== "") && (
								<button
									type="button"
									onClick={() => {
										setTypeFilter("all");
										setSearch("");
									}}
									className="h-9 rounded-lg border border-border bg-muted/60 px-3 text-muted-foreground text-xs transition hover:bg-muted hover:text-foreground"
								>
									Clear
								</button>
							)}

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

							<p className="ml-auto text-muted-foreground text-xs">
								{filtered.length} of {payments.length}
							</p>
						</div>

						{/* ── Payment list ── */}
						<PaymentGrid
							payments={sortedPayments}
							allPayments={payments}
							isLoading={isLoading}
							viewMode={viewMode}
							voidingId={voidingId}
							onViewDetail={(payment) => setDetailId(payment.id)}
							onVoid={(payment) => setVoidingId(payment.id)}
						/>

						{/* Void confirmation — one instance at page level */}
						{(() => {
							const voidingPayment =
								payments.find((p) => p.id === voidingId) ?? null;
							return voidingPayment ? (
								<ConfirmDialog
									open={voidingId !== null}
									onOpenChange={(open) => {
										if (!open) setVoidingId(null);
									}}
									title="Void this payment?"
									description={
										voidingPayment.paymentGroupId
											? "This is part of a combined payment. Voiding it will create reversal entries for every unit allocation in the group. The original records are preserved for audit purposes."
											: `This will create a reversal entry for ${formatRupees(voidingPayment.amount)}. The original record is preserved for audit purposes.`
									}
									confirmLabel="Void Payment"
									destructive
									onConfirm={() => {
										const onSuccess = () => setVoidingId(null);
										if (voidingPayment.paymentGroupId) {
											voidPaymentGroup.mutate(
												{ id: voidingPayment.paymentGroupId },
												{ onSuccess },
											);
										} else {
											voidPayment.mutate(
												{ id: voidingPayment.id },
												{ onSuccess },
											);
										}
									}}
									isLoading={
										voidPayment.isPending || voidPaymentGroup.isPending
									}
								/>
							) : null;
						})()}

						{/* One dialog instance, driven by detailId — not N per row */}
						<PaymentDetailDialog
							payment={selectedPayment}
							open={detailId !== null}
							onClose={() => setDetailId(null)}
						/>
					</>
				) : (
					<>
						{/* ── Adjustments filter bar ── */}
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative min-w-50 flex-1 sm:max-w-xs">
								<IconSearch className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
								<input
									type="search"
									placeholder="Search by credit note or reason…"
									value={adjSearch}
									onChange={(e) => setAdjSearch(e.target.value)}
									className="h-9 w-full rounded-lg border border-border bg-background pr-3 pl-9 text-sm outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/15"
								/>
							</div>
							<select
								value={adjTypeFilter}
								onChange={(e) => setAdjTypeFilter(e.target.value)}
								className="h-9 cursor-pointer appearance-none rounded-lg border border-border bg-background px-3 pr-8 text-foreground text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
								style={{
									backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
									backgroundRepeat: "no-repeat",
									backgroundPosition: "right 10px center",
								}}
							>
								<option value="all">All types</option>
								<option value="discount">Discount</option>
								<option value="write_off">Write-off</option>
								<option value="credit_note">Credit note</option>
							</select>
							{(adjTypeFilter !== "all" || adjSearch.trim() !== "") && (
								<button
									type="button"
									onClick={() => {
										setAdjTypeFilter("all");
										setAdjSearch("");
									}}
									className="h-9 rounded-lg border border-border bg-muted/60 px-3 text-muted-foreground text-xs transition hover:bg-muted hover:text-foreground"
								>
									Clear
								</button>
							)}
							<p className="ml-auto text-muted-foreground text-xs">
								{adjFiltered.length} settled •{" "}
								{allCredits.length - settledCredits.length} pending (hidden
								until payment)
							</p>
						</div>

						{/* ── Adjustments list ── */}
						{creditsLoading ? (
							<PageLoader />
						) : adjFiltered.length === 0 ? (
							<div className="rounded-xl border border-dashed bg-card px-6 py-12 text-center">
								<IconTag className="mx-auto size-8 text-muted-foreground/40" />
								<p className="mt-3 font-medium text-sm">
									No settled adjustments
								</p>
								<p className="mx-auto mt-1 max-w-md text-muted-foreground text-xs">
									Discounts/write-offs appear here only after the tenant’s
									payment is recorded. Unpaid bills with credits remain hidden —
									create a payment for the discounted{" "}
									<span className="font-mono">amountDue</span> to settle.
									{allCredits.length > 0 &&
									allCredits.length !== adjFiltered.length
										? ` (${allCredits.length - settledCredits.length} still pending)`
										: ""}
								</p>
							</div>
						) : (
							<div className="overflow-hidden rounded-xl border bg-white">
								<div className="hidden grid-cols-[minmax(10rem,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_minmax(12rem,1.4fr)_minmax(7rem,0.6fr)] items-center gap-4 border-b bg-muted/30 px-5 py-2.5 font-semibold text-[10px] text-muted-foreground uppercase tracking-wider lg:grid">
									<span>Credit note</span>
									<span>Type</span>
									<span className="text-right">Amount</span>
									<span>Reason</span>
									<span className="text-right">Bill</span>
								</div>
								{adjFiltered.map((c) => (
									<div
										key={c.id}
										className="grid gap-2 border-b px-4 py-4 last:border-0 lg:grid-cols-[minmax(10rem,1fr)_minmax(7rem,0.7fr)_minmax(7rem,0.7fr)_minmax(12rem,1.4fr)_minmax(7rem,0.6fr)] lg:items-center lg:px-5"
									>
										<div className="min-w-0">
											<p className="font-mono font-semibold text-xs">
												{c.creditNoteNo}
											</p>
											<p className="text-[11px] text-muted-foreground">
												{fmtDate(c.createdAt)} •{" "}
												{c.appliedAs === "refund" ? "Refund" : "Adjust"}
											</p>
										</div>
										<div>
											<Badge
												variant="secondary"
												className={
													c.type === "write_off"
														? "bg-amber-50 text-amber-700"
														: c.type === "discount"
															? "bg-violet-50 text-violet-700"
															: "bg-sky-50 text-sky-700"
												}
											>
												{c.type.replaceAll("_", " ")}
											</Badge>
											{c.reversedAt ? (
												<Badge
													variant="secondary"
													className="ml-1 bg-destructive/10 text-destructive"
												>
													reversed
												</Badge>
											) : null}
										</div>
										<div className="text-right">
											<p className="font-bold text-amber-700 text-sm tabular-nums">
												{formatRupees(c.amount)}
											</p>
											<p className="text-[11px] text-muted-foreground">
												{c.amount < 0 ? "reduction" : "reversal"}
											</p>
										</div>
										<div className="min-w-0">
											<p className="truncate text-sm">{c.reason}</p>
											<p className="truncate text-[11px] text-muted-foreground">
												Lease {c.leaseId.slice(0, 8).toUpperCase()}{" "}
												{c.utilityId
													? `• Utl ${c.utilityId.slice(0, 8).toUpperCase()}`
													: "• Rent"}
											</p>
										</div>
										<div className="text-right">
											<a
												href={
													c.utilityId
														? `/utilities/${c.utilityId}`
														: `/leases/${c.leaseId}`
												}
												className="font-medium text-primary text-xs hover:underline"
											>
												View bill
											</a>
											<a
												href={`/credit-notes/${c.id}`}
												className="ml-2 text-muted-foreground text-xs hover:underline"
											>
												Note
											</a>
										</div>
									</div>
								))}
								<div className="flex items-center justify-between bg-muted/20 px-5 py-3 text-xs">
									<span className="text-muted-foreground">
										Net settled adjustments
									</span>
									<span className="font-bold text-amber-700 tabular-nums">
										{formatRupees(adjTotal)}
									</span>
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</Container>
	);
}
