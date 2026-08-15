"use client";

import { PAYMENT_TYPES } from "@rently/db/constants/rent-constants";
import type { Badge } from "@rently/ui/components/badge";
import {
	IconBuildingBank,
	IconCash,
	IconCreditCard,
	IconCurrencyRupee,
} from "@tabler/icons-react";

export interface TypeConfig {
	avatarBg: string;
	avatarText: string;
	accentBar: string;
	badgeVariant: React.ComponentProps<typeof Badge>["variant"];
	label: string;
	headerGradient: string;
}

export function getTypeConfig(type: string): TypeConfig {
	switch (type) {
		case PAYMENT_TYPES.RENT:
			return {
				avatarBg: "bg-primary/10",
				avatarText: "text-primary",
				accentBar: "bg-primary",
				badgeVariant: "default",
				label: "Rent Payment",
				headerGradient: "from-primary/[0.12] via-primary/[0.03] to-transparent",
			};
		case PAYMENT_TYPES.UTILITY:
			return {
				avatarBg: "bg-amber-500/10",
				avatarText: "text-amber-600",
				accentBar: "bg-amber-500",
				badgeVariant: "secondary",
				label: "Utility Bill",
				headerGradient:
					"from-amber-500/[0.12] via-amber-500/[0.03] to-transparent",
			};
		case PAYMENT_TYPES.DEPOSIT:
			return {
				avatarBg: "bg-emerald-500/10",
				avatarText: "text-emerald-600",
				accentBar: "bg-emerald-500",
				badgeVariant: "outline",
				label: "Security Deposit",
				headerGradient:
					"from-emerald-500/[0.12] via-emerald-500/[0.03] to-transparent",
			};
		case PAYMENT_TYPES.REVERSAL:
			return {
				avatarBg: "bg-destructive/10",
				avatarText: "text-destructive",
				accentBar: "bg-destructive",
				badgeVariant: "destructive",
				label: "Void / Reversal",
				headerGradient:
					"from-destructive/[0.12] via-destructive/[0.03] to-transparent",
			};
		default:
			return {
				avatarBg: "bg-muted",
				avatarText: "text-muted-foreground",
				accentBar: "bg-border",
				badgeVariant: "outline",
				label: "Other Payment",
				headerGradient: "from-border/[0.12] via-border/[0.03] to-transparent",
			};
	}
}

export function MethodIcon({
	method,
	className = "size-3.5 shrink-0",
}: {
	method: string | null | undefined;
	className?: string;
}) {
	switch (method) {
		case "upi":
		case "online":
			return <IconCurrencyRupee className={className} />;
		case "cash":
			return <IconCash className={className} />;
		case "bank_transfer":
		case "cheque":
			return <IconBuildingBank className={className} />;
		default:
			return <IconCreditCard className={className} />;
	}
}
