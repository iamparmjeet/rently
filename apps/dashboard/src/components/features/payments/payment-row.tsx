"use client";

import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { formatRupees } from "@rently/ui/lib/currency";
import type { PaymentListItem } from "@rently/validators";
import { IconChevronRight, IconDots, IconTrash } from "@tabler/icons-react";
import { getTypeConfig, MethodIcon } from "./payment-helpers";

export interface PaymentRowProps {
	payment: PaymentListItem;
	isVoiding?: boolean;
	isLast?: boolean;
	onClick: () => void;
	onVoid: () => void;
}

export function PaymentRow({
	payment,
	isVoiding,
	isLast,
	onClick,
	onVoid,
}: PaymentRowProps) {
	const config = getTypeConfig(payment.type);

	return (
		<div
			className={[
				"group flex items-center gap-3 px-4 py-3.5 transition-colors sm:px-5",
				isLast ? "" : "border-b",
				isVoiding ? "pointer-events-none opacity-50" : "hover:bg-muted/30",
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
				onClick={onClick}
			>
				<p className="truncate font-semibold text-sm">
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
						{payment.paymentMethods?.replace("_", " ") ?? "No method"}
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
				onClick={onClick}
			>
				<span
					className={`font-semibold text-sm tabular-nums leading-tight ${
						payment.type === PAYMENT_TYPES.REVERSAL ? "text-destructive" : ""
					}`}
				>
					{formatRupees(payment.amount)}
				</span>
				<span className="text-[11px] text-muted-foreground">
					{fmtDate(payment.paymentDate)}
				</span>
				<Badge
					variant={config.badgeVariant}
					className="mt-1 h-4 rounded-full px-1.5 py-0 text-[10px] capitalize"
				>
					{payment.type}
				</Badge>
			</button>

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
					<DropdownMenuItem variant="destructive" onClick={onVoid}>
						<IconTrash className="mr-2 size-4" />
						Void Payment
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<button
				type="button"
				className="flex items-center text-muted-foreground/40 transition-colors hover:text-muted-foreground"
				onClick={onClick}
			>
				<IconChevronRight className="size-4" />
			</button>
		</div>
	);
}

function fmtDate(date: Date | string) {
	return new Date(date).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});
}
