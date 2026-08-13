"use client";

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
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { formatRupees } from "@rently/ui/lib/currency";
import type { DateRange } from "@rently/ui/lib/date";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { PageHeader } from "@rently/ui/shared/page-header";
import { PageLoader } from "@rently/ui/shared/page-loader";
import type { PaymentListItem } from "@rently/validators";
import {
	IconArrowsSort,
	IconBrandWhatsapp,
	IconBuildingBank,
	IconCash,
	IconChartBar,
	IconChevronDown,
	IconChevronRight,
	IconCreditCard,
	IconCurrencyRupee,
	IconDots,
	IconDownload,
	IconMail,
	IconReceipt,
	IconRefreshAlert,
	IconSearch,
	IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";
import { AddPaymentButton } from "@/components/features/payments/add-payment-button";
import { PaymentExportDialog } from "@/components/features/payments/payment-export-dialog";
import { Container } from "@/components/shared/container";
import {
	useDeletePayment,
	useOwnerPaymentExport,
	usePayments,
	useSendPaymentReceipt,
} from "@/hooks/payments";

// ── Type config ───────

interface TypeConfig {
	avatarBg: string;
	avatarText: string;
	accentBar: string;
	badgeVariant: React.ComponentProps<typeof Badge>["variant"];
	label: string;
}

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

function getTypeConfig(type: string): TypeConfig {
	switch (type) {
		case PAYMENT_TYPES.RENT:
			return {
				avatarBg: "bg-primary/10",
				avatarText: "text-primary",
				accentBar: "bg-primary",
				badgeVariant: "default",
				label: "Rent Payment",
			};
		case PAYMENT_TYPES.UTILITY:
			return {
				avatarBg: "bg-amber-500/10",
				avatarText: "text-amber-600",
				accentBar: "bg-amber-500",
				badgeVariant: "secondary",
				label: "Utility Bill",
			};
		case PAYMENT_TYPES.DEPOSIT:
			return {
				avatarBg: "bg-emerald-500/10",
				avatarText: "text-emerald-600",
				accentBar: "bg-emerald-500",
				badgeVariant: "outline",
				label: "Security Deposit",
			};
		case PAYMENT_TYPES.REVERSAL:
			return {
				avatarBg: "bg-destructive/10",
				avatarText: "text-destructive",
				accentBar: "bg-destructive",
				badgeVariant: "destructive",
				label: "Void / Reversal",
			};
		default:
			return {
				avatarBg: "bg-muted",
				avatarText: "text-muted-foreground",
				accentBar: "bg-border",
				badgeVariant: "outline",
				label: "Other Payment",
			};
	}
}

function MethodIcon({ method }: { method: string | null | undefined }) {
	const cls = "size-3.5 shrink-0";
	switch (method) {
		case "upi":
		case "online":
			return <IconCurrencyRupee className={cls} />;
		case "cash":
			return <IconCash className={cls} />;
		case "bank_transfer":
		case "cheque":
			return <IconBuildingBank className={cls} />;
		default:
			return <IconCreditCard className={cls} />;
	}
}

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
				<DialogHeader className="relative flex flex-row items-center justify-between overflow-hidden bg-gradient-to-br from-primary/[0.12] via-primary/[0.03] to-transparent px-5 py-4">
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

				<div className="mx-5 rounded-lg border bg-muted/[0.15] p-4">
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
				<DialogFooter className="mt-5 flex-row gap-2 border-t bg-muted/[0.12] px-5 py-3 sm:justify-between">
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
	const voidPayment = useDeletePayment();
	const exportPayments = useOwnerPaymentExport();
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [search, setSearch] = useState("");
	const [sort, setSort] = useState<PaymentSort>("payment-date-desc");
	const [voidingId, setVoidingId] = useState<string | null>(null);
	const [detailId, setDetailId] = useState<string | null>(null);
	const [exportOpen, setExportOpen] = useState(false);

	if (isLoading) return <PageLoader />;

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

	const now = new Date();
	const thisMonthPayments = payments.filter((p) => {
		const d = new Date(p.paymentDate);
		return (
			d.getFullYear() === now.getFullYear() &&
			d.getMonth() === now.getMonth() &&
			p.type !== PAYMENT_TYPES.REVERSAL
		);
	});
	const thisMonthTotal = thisMonthPayments.reduce((s, p) => s + p.amount, 0);
	const allTimeTotal = payments
		.filter((p) => p.type !== PAYMENT_TYPES.REVERSAL)
		.reduce((s, p) => s + p.amount, 0);
	const reversalCount = payments.filter(
		(p) => p.type === PAYMENT_TYPES.REVERSAL,
	).length;

	const selectedPayment = payments.find((p) => p.id === detailId) ?? null;

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
				</PageHeader>

				<PaymentExportDialog
					open={exportOpen}
					onOpenChange={setExportOpen}
					onExport={handlePaymentExport}
					isExporting={exportPayments.isPending}
				/>

				<section className="overflow-hidden rounded-xl border bg-card shadow-sm">
					<div className="grid divide-y sm:grid-cols-[1.05fr_1fr] sm:divide-x sm:divide-y-0">
						<div className="relative overflow-hidden bg-gradient-to-br from-primary/[0.08] via-card to-card p-5">
							<div className="absolute -top-10 -right-10 size-32 rounded-full bg-primary/[0.08] blur-2xl" />
							<div className="relative">
								<p className="font-medium text-muted-foreground text-xs uppercase tracking-[0.14em]">
									Collection health
								</p>
								<p className="mt-1 font-semibold text-3xl tabular-nums tracking-tight">
									{formatRupees(thisMonthTotal)}
								</p>
								<p className="mt-2 text-muted-foreground text-xs">
									Collected this month · {thisMonthPayments.length} transaction
									{thisMonthPayments.length !== 1 ? "s" : ""}
								</p>
							</div>
						</div>
						<div className="grid grid-cols-3 divide-x">
							<PaymentMetric
								icon={IconChartBar}
								label="All time"
								value={formatRupees(allTimeTotal)}
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

					<p className="ml-auto text-muted-foreground text-xs">
						{filtered.length} of {payments.length}
					</p>
				</div>

				{/* ── Payment list ── */}
				{filtered.length === 0 ? (
					<EmptyState
						className="rounded-xl border bg-card shadow-sm"
						icon={IconReceipt}
						title={
							payments.length === 0
								? "No payments yet"
								: "No payments match this filter"
						}
						description={
							payments.length === 0
								? "Record your first payment to start tracking rent collections."
								: undefined
						}
					/>
				) : (
					<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
						{sortedPayments.map((payment, index) => {
							const config = getTypeConfig(payment.type);
							const isVoiding =
								voidPayment.isPending && voidingId === payment.id;

							return (
								<div
									key={payment.id}
									className={[
										"group flex items-center gap-3 px-4 py-3.5 transition-colors sm:px-5",
										index !== sortedPayments.length - 1 ? "border-b" : "",
										isVoiding
											? "pointer-events-none opacity-50"
											: "hover:bg-muted/30",
									].join(" ")}
								>
									<div
										className={`flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm ring-1 ring-black/5 ring-inset ${config.avatarBg} ${config.avatarText}`}
									>
										{payment.type.charAt(0).toUpperCase()}
									</div>

									<button
										type="button"
										className="min-w-0 flex-1 text-left"
										onClick={() => setDetailId(payment.id)}
									>
										<p className="truncate font-semibold text-sm">
											{/* tenantName from enriched API is shown here now,
											    replacing "Rent Payment" as the primary identifier.
												   Falls back to type label if name isn't available yet. */}
											{payment.tenantName ?? config.label}
											{payment.description && (
												<span className="ml-1.5 font-normal text-muted-foreground text-xs">
													· {payment.description}
												</span>
											)}
										</p>
										<p className="mt-1 flex items-center gap-1.5 text-muted-foreground text-xs">
											<MethodIcon method={payment.paymentMethods} />
											<span className="capitalize">
												{payment.paymentMethods?.replace("_", " ") ??
													"No method"}
											</span>
											<span>·</span>
											<span className="font-mono">
												#{payment.leaseId.slice(0, 8).toUpperCase()}
											</span>
										</p>
									</button>

									<button
										type="button"
										className="flex min-w-23 shrink-0 flex-col items-end gap-0.5 text-right"
										onClick={() => setDetailId(payment.id)}
									>
										<span
											className={`font-semibold text-sm tabular-nums leading-tight ${
												payment.type === PAYMENT_TYPES.REVERSAL
													? "text-destructive"
													: ""
											}`}
										>
											{formatRupees(payment.amount)}
										</span>
										<span className="text-[11px] text-muted-foreground">
											{fmtDate(payment.paymentDate, {
												day: "2-digit",
												month: "short",
												year: "numeric",
											})}
										</span>
										<Badge
											variant={config.badgeVariant}
											className="mt-1 h-4 rounded-full px-1.5 py-0 text-[10px] capitalize"
										>
											{payment.type}
										</Badge>
									</button>

									{/*<div
										className="flex shrink-0 items-center gap-1"
										onClick={(e) => e.stopPropagation()}
									>*/}
									<DropdownMenu>
										<DropdownMenuTrigger
											render={
												<Button
													variant="ghost"
													size="icon"
													className="size-8"
													disabled={payment.type === PAYMENT_TYPES.REVERSAL}
												>
													<IconDots className="size-4" />
												</Button>
											}
										/>
										<DropdownMenuContent align="end">
											<DropdownMenuSeparator />
											<DropdownMenuItem
												variant="destructive"
												onClick={() => setVoidingId(payment.id)}
											>
												<IconTrash className="mr-2 size-4" />
												Void Payment
											</DropdownMenuItem>
										</DropdownMenuContent>
									</DropdownMenu>

									<button
										type="button"
										className="flex items-center text-muted-foreground/40 transition-colors hover:text-muted-foreground"
										onClick={() => setDetailId(payment.id)}
									>
										<IconChevronRight className="size-4" />
									</button>
									{/*</div>*/}

									<ConfirmDialog
										open={voidingId === payment.id}
										onOpenChange={(open) => {
											if (!open) setVoidingId(null);
										}}
										title="Void this payment?"
										description={`This will create a reversal entry for ${formatRupees(payment.amount)}. The original record is preserved for audit purposes.`}
										confirmLabel="Void Payment"
										destructive
										onConfirm={() => {
											voidPayment.mutate(
												{ id: payment.id },
												{ onSuccess: () => setVoidingId(null) },
											);
										}}
										isLoading={voidPayment.isPending}
									/>
								</div>
							);
						})}
					</div>
				)}

				{/* One dialog instance, driven by detailId — not N per row */}
				<PaymentDetailDialog
					payment={selectedPayment}
					open={detailId !== null}
					onClose={() => setDetailId(null)}
				/>
			</div>
		</Container>
	);
}
