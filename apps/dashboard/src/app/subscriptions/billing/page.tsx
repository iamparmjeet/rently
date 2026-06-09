"use client";

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { Skeleton } from "@rently/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { formatRupees } from "@rently/ui/lib/currency";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { PageHeader } from "@rently/ui/shared/page-header";
import { IconArrowLeft, IconReceipt } from "@tabler/icons-react";
import { format } from "date-fns";
import Link from "next/link";
import { Container } from "@/components/shared/container";
import { useMySubscription } from "@/hooks/subscriptions";

//  Payment status badge
const STATUS_STYLES = {
	paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
	unpaid:
		"bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
	failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
} as const;

function StatusBadge({ status }: { status: string }) {
	const style =
		STATUS_STYLES[status as keyof typeof STATUS_STYLES] ??
		"bg-muted text-muted-foreground";
	return (
		<span
			className={`rounded-sm px-2 py-0.5 font-medium text-[10px] capitalize ${style}`}
		>
			{status}
		</span>
	);
}

//  Loading skeleton
function BillingSkeleton() {
	return (
		<div className="col-span-12 space-y-2">
			{[0, 1, 2, 3].map((i) => (
				<Skeleton key={i} className="h-12 w-full rounded-lg" />
			))}
		</div>
	);
}

//  Main page
export default function BillingPage() {
	const { data, isLoading } = useMySubscription();

	const invoices = data?.invoices ?? [];

	return (
		<Container>
			<div className="col-span-12 flex flex-col gap-6">
				{/*  Header  */}
				<PageHeader
					title="Billing History"
					description="Your invoices and payment history"
				>
					<Button
						variant="ghost"
						size="sm"
						render={<Link href="/subscriptions" />}
					>
						<IconArrowLeft className="size-3.5" />
						Back
					</Button>
				</PageHeader>

				{isLoading ? (
					<BillingSkeleton />
				) : invoices.length === 0 ? (
					<EmptyState
						icon={IconReceipt}
						title="No invoices yet"
						description="Your billing history will appear here once you upgrade to a paid plan."
					>
						<Button
							size="sm"
							variant="outline"
							render={<Link href="/subscriptions/plans" />}
						>
							View Plans
						</Button>
					</EmptyState>
				) : (
					<div className="col-span-12">
						<Card>
							<CardHeader className="border-b">
								<CardTitle className="text-sm">Invoices</CardTitle>
							</CardHeader>
							<CardContent className="p-0">
								<Table>
									<TableHeader>
										<TableRow>
											<TableHead className="text-[10px] text-muted-foreground uppercase">
												Period
											</TableHead>
											<TableHead className="text-[10px] text-muted-foreground uppercase">
												Amount
											</TableHead>
											<TableHead className="text-[10px] text-muted-foreground uppercase">
												Status
											</TableHead>
											<TableHead className="text-[10px] text-muted-foreground uppercase">
												Date
											</TableHead>
										</TableRow>
									</TableHeader>
									<TableBody>
										{invoices.map((inv) => (
											<TableRow key={inv.id}>
												<TableCell className="text-xs">
													{format(new Date(inv.periodStart), "MMM yyyy")}
													{" → "}
													{format(new Date(inv.periodEnd), "MMM yyyy")}
												</TableCell>
												<TableCell className="font-medium text-xs">
													{formatRupees(inv.amount)}
												</TableCell>
												<TableCell>
													<StatusBadge status={inv.paymentStatus ?? "unpaid"} />
												</TableCell>
												<TableCell className="text-muted-foreground text-xs">
													{format(new Date(inv.createdAt), "d MMM yyyy")}
												</TableCell>
											</TableRow>
										))}
									</TableBody>
								</Table>
							</CardContent>
						</Card>
					</div>
				)}
			</div>
		</Container>
	);
}
