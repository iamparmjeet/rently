"use client";

import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import type { PaymentListItem } from "@rently/validators";
import { IconTrash } from "@tabler/icons-react";
import { format } from "date-fns";
import { getTypeConfig, MethodIcon } from "./payment-helpers";

export interface PaymentCardProps {
	payment: PaymentListItem;
	isVoiding?: boolean;
	actionsSlot?: React.ReactNode;
	onClick?: () => void;
	onVoid?: () => void;
}

export function PaymentCard({
	payment,
	isVoiding,
	actionsSlot,
	onClick,
	onVoid,
}: PaymentCardProps) {
	const config = getTypeConfig(payment.type);
	const isReversal = payment.type === PAYMENT_TYPES.REVERSAL;

	return (
		<Card
			className={cn(
				"gap-0 overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
				isVoiding && "pointer-events-none opacity-50",
				onClick && "cursor-pointer",
			)}
			onClick={onClick}
		>
			<CardHeader
				className={cn(
					"relative border-b bg-gradient-to-br px-5 pt-5 pb-4",
					config.headerGradient,
				)}
			>
				<div className="flex items-start justify-between">
					<div className="flex min-w-0 items-start gap-3">
						<div
							className={cn(
								"flex size-10 shrink-0 items-center justify-center rounded-xl font-bold text-sm",
								config.avatarBg,
								config.avatarText,
							)}
						>
							{payment.type.charAt(0).toUpperCase()}
						</div>
						<CardTitle className="min-w-0 pt-0.5">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								{config.label}
							</p>
							<p className="truncate font-semibold text-base">
								{payment.tenantName ?? config.label}
							</p>
							<p className="mt-1 line-clamp-1 text-muted-foreground text-xs">
								Lease #{payment.leaseId.slice(0, 8).toUpperCase()}
								{payment.description && <span> · {payment.description}</span>}
							</p>
						</CardTitle>
					</div>
					<div className="flex items-center gap-2">
						<Badge
							variant={config.badgeVariant}
							className="h-4 rounded-full px-1.5 py-0 text-[10px] capitalize"
						>
							{payment.type}
						</Badge>
						{actionsSlot}
					</div>
				</div>
			</CardHeader>

			<CardContent className="space-y-3 bg-card px-5 py-4">
				<div className="flex items-end justify-between gap-3">
					<div>
						<p className="text-muted-foreground text-xs">Amount</p>
						<p
							className={cn(
								"mt-1 font-bold text-2xl tabular-nums tracking-tight",
								isReversal ? "text-destructive" : "text-foreground",
							)}
						>
							{formatRupees(payment.amount)}
						</p>
					</div>
					<div className="text-right">
						<p className="text-muted-foreground text-xs">Method</p>
						<p className="mt-1 flex items-center justify-end gap-1.5 font-medium text-sm">
							<MethodIcon method={payment.paymentMethods} />
							<span className="capitalize">
								{payment.paymentMethods?.replace("_", " ") ?? "No method"}
							</span>
						</p>
					</div>
				</div>
				<div className="flex items-center justify-between text-xs">
					<span className="text-muted-foreground">Payment date</span>
					<span className="font-medium tabular-nums">
						{fmtDate(payment.paymentDate)}
					</span>
				</div>
				{payment.referenceNumber && (
					<div className="flex items-center justify-between text-xs">
						<span className="text-muted-foreground">Reference</span>
						<span className="font-medium font-mono tabular-nums">
							{payment.referenceNumber}
						</span>
					</div>
				)}
			</CardContent>

			<CardFooter className="flex w-full items-center justify-between gap-3 border-t px-5 py-3.5">
				<p className="min-w-0 truncate text-muted-foreground text-xs">
					Recorded {format(new Date(payment.createdAt), "dd MMM yyyy")}
				</p>
				<div className="flex shrink-0 items-center gap-1">
					{onVoid && !isReversal && (
						<Button
							variant="ghost"
							size="sm"
							className="text-destructive hover:text-destructive"
							onClick={(e) => {
								e.stopPropagation();
								onVoid();
							}}
						>
							<IconTrash className="mr-1 size-3.5" />
							Void
						</Button>
					)}
				</div>
			</CardFooter>
		</Card>
	);
}

function fmtDate(date: Date | string) {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}
