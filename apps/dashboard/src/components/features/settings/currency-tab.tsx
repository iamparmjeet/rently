"use client";

// localStorage here: preferredCurrency column doesn't exist in ownerProfiles
// (migration pending). localStorage is an acceptable interim — the setting
// is display-only and user-specific, not business-critical data.
// TODO: move to ownerProfiles.preferredCurrency after DB migration.

import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import { cn } from "@rently/ui/lib/utils";
import { IconCheck } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type Currency = "INR" | "USD";

const CURRENCY_STORAGE_KEY = "rently_display_currency";

const currencies: {
	code: Currency;
	label: string;
	symbol: string;
	flag: string;
	note: string;
}[] = [
	{
		code: "INR",
		label: "Indian Rupee (₹)",
		symbol: "₹",
		flag: "🇮🇳",
		note: "INR · Paisa stored internally",
	},
	{
		code: "USD",
		label: "US Dollar ($)",
		symbol: "$",
		flag: "🇺🇸",
		note: "USD · Cents stored internally · 1 USD ≈ ₹84",
	},
];

export function CurrencyTab() {
	// WHY useState with function init: reads localStorage only on mount —
	// avoids hydration mismatch on SSR (Next.js renders server-side first).
	const [selected, setSelected] = useState<Currency>("INR");
	const [hasLoaded, setHasLoaded] = useState(false);

	useEffect(() => {
		const stored = localStorage.getItem(
			CURRENCY_STORAGE_KEY,
		) as Currency | null;
		if (stored === "INR" || stored === "USD") {
			setSelected(stored);
		}
		setHasLoaded(true);
	}, []);

	function handleSave() {
		localStorage.setItem(CURRENCY_STORAGE_KEY, selected);
		toast.success(`Display currency set to ${selected}`);
	}

	if (!hasLoaded) return null; // Avoid flash of wrong currency on hydration

	return (
		<div className="space-y-4">
			<Card>
				<CardContent className="space-y-4 pt-6">
					<div>
						<p className="font-medium text-sm">Display Currency</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							All amounts are stored in paisa / cents internally and converted
							for display. Switch anytime.
						</p>
					</div>

					<div className="space-y-2">
						{currencies.map((currency) => {
							const isSelected = selected === currency.code;
							return (
								<button
									key={currency.code}
									type="button"
									onClick={() => setSelected(currency.code)}
									className={cn(
										"flex w-full items-center justify-between rounded-lg border p-4 text-left transition-colors",
										isSelected
											? "border-primary bg-primary/5"
											: "border-border hover:border-muted-foreground/50",
									)}
								>
									<div className="flex items-center gap-3">
										<span className="text-2xl">{currency.flag}</span>
										<div>
											<p className="font-medium text-sm">{currency.label}</p>
											<p className="text-muted-foreground text-xs">
												{currency.note}
											</p>
										</div>
									</div>
									{isSelected && (
										<div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary">
											<IconCheck className="size-3 text-primary-foreground" />
										</div>
									)}
								</button>
							);
						})}
					</div>

					<div className="rounded-md bg-muted px-3 py-2">
						<p className="text-muted-foreground text-xs">
							<span className="font-medium">Current rate:</span> 1 USD = ₹84.00
							· Last updated: Today
						</p>
					</div>

					<div>
						<Button onClick={handleSave} size="sm">
							Save Preference
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
