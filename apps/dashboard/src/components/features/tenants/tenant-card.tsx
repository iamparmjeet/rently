import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent, CardHeader } from "@rently/ui/components/card";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import { DateRecordMeta } from "@rently/ui/shared/date-record-meta";
import type { TenantListItem } from "@rently/validators";
import {
	IconArrowRight,
	IconBuilding,
	IconMail,
	IconPhone,
	IconUser,
} from "@tabler/icons-react";
import type { Route } from "next";
import Image from "next/image";
import Link from "next/link";

interface TenantCardProps {
	tenant: TenantListItem;
	actionsSlot?: React.ReactNode;
}

const statusVariants = {
	accepted: "default",
	pending: "secondary",
	expired: "outline",
} as const;

export function TenantCard({ tenant, actionsSlot }: TenantCardProps) {
	const lease = tenant.currentLease;
	const totalRent = tenant.activeLeases.reduce(
		(sum, activeLease) => sum + activeLease.rent,
		0,
	);

	return (
		<Card className="group flex h-full flex-col overflow-hidden transition-shadow hover:shadow-md">
			<CardHeader className="pb-4">
				<div className="flex items-start justify-between gap-3">
					<div className="flex min-w-0 items-center gap-3">
						<div className="relative flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-primary">
							{tenant.avatarUrl ? (
								<Image
									src={tenant.avatarUrl}
									alt={tenant.name}
									fill
									className="object-cover"
								/>
							) : (
								<IconUser className="size-5" />
							)}
						</div>

						<div className="min-w-0">
							<h3 className="truncate font-semibold">{tenant.name}</h3>
							<p className="mt-0.5 text-muted-foreground text-xs">
								{tenant.status === "accepted"
									? "Active tenant"
									: "Invitation pending"}
							</p>
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-1.5">
						<Badge
							variant={statusVariants[tenant.status]}
							className="capitalize"
						>
							{tenant.status}
						</Badge>
						{actionsSlot}
					</div>
				</div>
			</CardHeader>

			<CardContent className="flex flex-1 flex-col gap-4">
				<div className="space-y-2 text-sm">
					<div className="flex items-center gap-2 text-muted-foreground">
						<IconMail className="size-4 shrink-0" />
						<span className="truncate">{tenant.email}</span>
					</div>

					{tenant.phone && (
						<div className="flex items-center gap-2 text-muted-foreground">
							<IconPhone className="size-4 shrink-0" />
							<span>{tenant.phone}</span>
						</div>
					)}
				</div>

				{lease ? (
					<div
						className={cn(
							"rounded-xl border bg-muted/40 p-4",
							lease.overdue && "border-destructive/20 bg-destructive/[0.03]",
						)}
					>
						<div className="flex items-start justify-between gap-3">
							<div className="min-w-0">
								<div className="flex items-center gap-2 font-medium">
									<IconBuilding className="size-4 shrink-0 text-muted-foreground" />
									<span className="truncate">
										{tenant.activeLeases.length > 1
											? `${tenant.activeLeases.length} active units`
											: lease.propertyName}
									</span>
								</div>

								<p className="mt-1 text-muted-foreground text-xs">
									{tenant.activeLeases.length > 1
										? "Combined monthly rent"
										: `Unit ${lease.unitNumber}`}
								</p>
							</div>

							<p className="shrink-0 font-semibold text-base">
								{formatRupees(
									tenant.activeLeases.length > 1 ? totalRent : lease.rent,
								)}
								<span className="ml-0.5 font-normal text-muted-foreground text-xs">
									/mo
								</span>
							</p>
						</div>

						{tenant.activeLeases.length === 1 && lease.endDate && (
							<p className="mt-3 border-t pt-3 text-muted-foreground text-xs">
								Lease ends{" "}
								{new Date(lease.endDate).toLocaleDateString("en-IN", {
									day: "numeric",
									month: "short",
									year: "numeric",
								})}
							</p>
						)}

						{lease.overdue && (
							<div className="mt-3 flex items-center justify-between gap-3 border-destructive/15 border-t pt-3">
								<Badge variant="destructive" className="text-xs">
									{lease.overdue.daysOverdue}d overdue
								</Badge>
								<span className="font-medium text-destructive text-xs">
									₹
									{(lease.overdue.outstandingAmount / 100).toLocaleString(
										"en-IN",
										{ minimumFractionDigits: 2 },
									)}{" "}
									due
								</span>
							</div>
						)}
					</div>
				) : (
					<div className="flex min-h-28 items-center justify-center rounded-xl border border-dashed bg-muted/20 px-4 text-center text-muted-foreground text-sm">
						No active lease
					</div>
				)}

				<div className="mt-auto space-y-4">
					<Button
						variant="outline"
						size="lg"
						className="w-full"
						render={<Link href={`/tenants/${tenant.id}` as Route} />}
					>
						View tenant
						<IconArrowRight className="ml-1 size-4" />
					</Button>

					<DateRecordMeta
						createdAt={tenant.createdAt}
						updatedAt={tenant.updatedAt}
						className="pt-3"
					/>
				</div>
			</CardContent>
		</Card>
	);
}
