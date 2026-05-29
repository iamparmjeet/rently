// apps/web/src/app/(dashboard)/payments/page.tsx
"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconReceipt } from "@tabler/icons-react";

export default function PaymentsPage() {
	return (
		<div className="col-span-12 flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl">Payments</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Track rent and utility payments across all leases
				</p>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconReceipt className="size-5 text-muted-foreground" />
						<CardTitle className="text-base">Payment Tracking</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="py-16 text-center">
					<IconReceipt className="mx-auto mb-4 size-16 text-muted-foreground/30" />
					<h3 className="mb-2 font-semibold text-lg">Coming Soon</h3>
					<p className="mx-auto max-w-md text-muted-foreground text-sm">
						Payment recording and tracking features are being developed. For
						now, you can manage properties, units, and leases.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
