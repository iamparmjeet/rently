import { Badge } from "@rently/ui/components/badge";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import type { UtilityListItem } from "@rently/validators";
import {
	IconBolt,
	IconCheck,
	IconDownload,
	IconDroplet,
	IconMail,
	IconTag,
	IconTool,
} from "@tabler/icons-react";
import { format } from "date-fns";
import { getUtilityDocumentAction } from "./utility-row-actions";

export interface UtilityCardProps {
	utility: UtilityListItem;
	isDeleting?: boolean;
	actionsSlot?: React.ReactNode;
	onWhatsApp?: () => void;
	onEmail?: () => void;
	onMarkPaid?: () => void;
	onDiscount?: () => void;
	onViewDetail?: () => void;
}

const TYPE_CONFIG = {
	electricity: {
		header: "from-amber-500/[0.12] via-amber-500/[0.03] to-transparent",
		icon: "bg-amber-50 text-amber-600",
		label: "Electricity",
		Icon: IconBolt,
	},
	water: {
		header: "from-sky-500/[0.12] via-sky-500/[0.03] to-transparent",
		icon: "bg-sky-50 text-sky-600",
		label: "Water",
		Icon: IconDroplet,
	},
	maintenance: {
		header: "from-violet-500/[0.12] via-violet-500/[0.03] to-transparent",
		icon: "bg-violet-50 text-violet-600",
		label: "Maintenance",
		Icon: IconTool,
	},
} as const;

export function UtilityCard({
	utility: u,
	isDeleting,
	actionsSlot,
	onWhatsApp,
	onEmail,
	onMarkPaid,
	onDiscount,
	onViewDetail,
}: UtilityCardProps) {
	const config = TYPE_CONFIG[u.utilityType] ?? TYPE_CONFIG.electricity;
	const isElectricity = u.utilityType === "electricity";

	const previous = Number(u.previousReading ?? 0);
	const current = Number(u.currentReading ?? 0);
	const consumed = Number(u.unitsUsed ?? current - previous);

	const amountDue = (u as { amountDue?: number }).amountDue ?? u.totalAmount;
	const isPaidDerived = amountDue <= 0;
	const hasReversedPayment = u.hasReversedPayment ?? false;
	const creditTotal = (u.credits ?? []).reduce(
		(sum, credit) => sum + credit.amount,
		0,
	);
	const hasDiscount = creditTotal !== 0;
	const showDiscount = hasDiscount && amountDue !== u.totalAmount;
	const discountedAmount =
		u.totalAmount +
		(u.credits ?? []).reduce((sum, credit) => sum + credit.amount, 0);
	const displayedAmount = isPaidDerived ? discountedAmount : amountDue;
	const amountLabel = isPaidDerived
		? "Bill amount"
		: showDiscount
			? "Amount due"
			: "Amount";

	const dateDisplay = new Date(u.currentReadingDate).toLocaleDateString(
		"en-IN",
		{ day: "2-digit", month: "short", year: "numeric" },
	);

	const startDisplay = u.previousReadingDate
		? new Date(u.previousReadingDate).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "—";

	const documentAction = getUtilityDocumentAction({
		utilityId: u.id,
		receiptPaymentId: u.receiptPaymentId,
	});
	const readingDate = format(new Date(u.currentReadingDate), "dd MMM yyyy");
	const paidDate = u.receiptPaymentDate
		? format(new Date(u.receiptPaymentDate), "dd MMM yyyy")
		: null;

	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
				isDeleting && "pointer-events-none opacity-50",
				onViewDetail && "cursor-pointer",
			)}
			onClick={onViewDetail}
		>
			<CardHeader
				className={cn(
					"relative border-b bg-gradient-to-br px-5 pt-5 pb-4",
					config.header,
				)}
			>
				<div className="flex items-start justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<div
							className={cn(
								"flex size-10 shrink-0 items-center justify-center rounded-xl",
								config.icon,
							)}
						>
							<config.Icon className="size-5" />
						</div>
						<CardTitle className="min-w-0 pt-0.5">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{config.label}
							</p>
							<p className="truncate font-semibold text-base">
								{u.tenantName ?? "Tenant unavailable"}
							</p>
							<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
								{u.propertyName} · Unit {u.unitNumber}
							</p>
						</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant="secondary"
							className={
								isPaidDerived
									? "bg-emerald-50 text-emerald-700"
									: "bg-amber-50 text-amber-700"
							}
						>
							{isPaidDerived
								? "Paid"
								: hasReversedPayment
									? "Payment voided"
									: "Unpaid"}
						</Badge>
						{actionsSlot}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-3 bg-card px-5 py-4">
				{isElectricity ? (
					<>
						<div className="flex items-end justify-between gap-3">
							<div>
								<p className="text-muted-foreground text-xs">Usage</p>
								<p className="mt-1 font-semibold text-lg tracking-tight">
									{consumed.toFixed(1)}{" "}
									<span className="font-normal text-muted-foreground text-xs">
										kWh
									</span>
								</p>
							</div>
							<div className="flex gap-4 text-right">
								<div>
									<p className="text-muted-foreground text-xs">{amountLabel}</p>
									<p className="mt-1 font-bold text-lg tabular-nums tracking-tight">
										{formatRupees(displayedAmount)}
									</p>
									{showDiscount ? (
										<p className="text-muted-foreground text-xs line-through">
											{formatRupees(u.totalAmount)}
										</p>
									) : null}
								</div>
								{isPaidDerived && hasDiscount ? (
									<div>
										<p className="text-muted-foreground text-xs">Due</p>
										<p className="mt-1 font-bold text-emerald-700 text-lg tabular-nums tracking-tight">
											{formatRupees(amountDue)}
										</p>
									</div>
								) : null}
							</div>
						</div>
						<div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Reading</span>
								<span className="font-medium tabular-nums">
									{previous.toFixed(1)} → {current.toFixed(1)}
								</span>
							</div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Period</span>
								<span className="font-medium tabular-nums">
									{startDisplay} – {dateDisplay}
								</span>
							</div>
						</div>
					</>
				) : (
					<>
						<div className="flex gap-4">
							<div>
								<p className="text-muted-foreground text-xs">{amountLabel}</p>
								<p className="mt-1 font-bold text-lg tabular-nums tracking-tight">
									{formatRupees(displayedAmount)}
								</p>
								{showDiscount ? (
									<p className="text-muted-foreground text-xs line-through">
										{formatRupees(u.totalAmount)}
									</p>
								) : null}
							</div>
							{isPaidDerived && hasDiscount ? (
								<div>
									<p className="text-muted-foreground text-xs">Due</p>
									<p className="mt-1 font-bold text-emerald-700 text-lg tabular-nums tracking-tight">
										{formatRupees(amountDue)}
									</p>
								</div>
							) : null}
						</div>
						<div>
							<div className="flex items-center justify-between text-xs">
								<span className="text-muted-foreground">Date</span>
								<span className="font-medium tabular-nums">{dateDisplay}</span>
							</div>
							<p className="mt-1 truncate text-muted-foreground text-xs">
								{u.description?.trim() || "Flat utility charge"}
							</p>
						</div>
					</>
				)}
			</CardContent>

			<CardFooter className="flex w-full items-center justify-between gap-3 border-t px-5 py-3.5">
				<div className="min-w-0 text-muted-foreground text-xs">
					<p className="font-medium text-[10px] uppercase tracking-wide">
						Reading
					</p>
					<p className="mt-0.5 whitespace-nowrap text-foreground">
						{readingDate}
					</p>
				</div>
				{paidDate ? (
					<div className="mr-auto text-muted-foreground text-xs">
						<p className="font-medium text-[10px] uppercase tracking-wide">
							Paid
						</p>
						<p className="mt-0.5 whitespace-nowrap text-emerald-700">
							{paidDate}
						</p>
					</div>
				) : null}
				<div className="flex shrink-0 items-center gap-1">
					<button
						type="button"
						className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							window.open(documentAction.href, "_blank", "noopener");
						}}
						title={documentAction.title}
					>
						<IconDownload className="size-3.5" />
					</button>
					{onWhatsApp && (
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-green-600 transition-colors hover:bg-muted"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onWhatsApp();
							}}
							title="Send via WhatsApp"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								viewBox="0 0 24 24"
								fill="currentColor"
								className="size-3.5"
							>
								<title>WhatsApp</title>
								<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52s-.67-1.612-.918-2.207c-.242-.579-.487-.5-.67-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.82 11.82 0 0 0-3.48-8.413z" />
							</svg>
						</button>
					)}
					{onEmail && (
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onEmail();
							}}
							title="Send via Email"
						>
							<IconMail className="size-3.5" />
						</button>
					)}
					{onDiscount && (
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-amber-600 transition-colors hover:bg-muted"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onDiscount();
							}}
							title="Add discount / credit note"
						>
							<IconTag className="size-3.5" />
						</button>
					)}
					{onMarkPaid && !isPaidDerived && (
						<button
							type="button"
							className="flex size-7 items-center justify-center rounded-md text-emerald-600 transition-colors hover:bg-muted"
							onClick={(e) => {
								e.preventDefault();
								e.stopPropagation();
								onMarkPaid();
							}}
							title="Mark as paid"
						>
							<IconCheck className="size-3.5" />
						</button>
					)}
				</div>
			</CardFooter>
		</Card>
	);
}
