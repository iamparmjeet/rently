import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent, CardHeader } from "@rently/ui/components/card";
import { DateRecordMeta } from "@rently/ui/shared/date-record-meta";
import type { TenantListItem } from "@rently/validators";
import {
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
	// Render slot — TenantCardActions injects the DropdownMenu here
	// Keeps the card dumb: it displays, actions component orchestrates
	actionsSlot?: React.ReactNode;
}

const statusVariants = {
	accepted: "default",
	pending: "secondary",
	expired: "outline",
} as const;

export function TenantCard({ tenant, actionsSlot }: TenantCardProps) {
	return (
		<Card className="flex flex-col pb-0">
			<CardHeader className="flex justify-between gap-4 space-y-0 pb-2">
				<div className="flex items-center gap-2">
					<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
						{tenant.avatarUrl ? (
							<Image
								src={tenant.avatarUrl}
								alt={tenant.name}
								fill
								className="size-full rounded-full object-cover"
							/>
						) : (
							<IconUser className="size-6 text-muted-foreground" />
						)}
					</div>
					<h3 className="truncate font-semibold">{tenant.name}</h3>
				</div>
				<div className="min-w-0 flex-1" />
				<Badge
					variant={statusVariants[tenant.status]}
					className="mt-1 capitalize"
				>
					{tenant.status}
				</Badge>
				{/* Action menu injected by parent */}
				{actionsSlot}
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{/* Contact info */}
				<div className="space-y-1 text-sm">
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
				{/* Lease info */}
				{tenant.currentLease ? (
					<div className="rounded-lg bg-muted/50 p-3 text-sm">
						<div className="flex items-center gap-2 font-medium">
							<IconBuilding className="size-4" />
							{tenant.currentLease.propertyName}
						</div>
						<div className="mt-1 text-muted-foreground">
							Unit {tenant.currentLease.unitNumber} · ₹
							{tenant.currentLease.rent.toLocaleString()}/mo
						</div>
						{tenant.currentLease.endDate && (
							<div className="mt-1 text-muted-foreground text-xs">
								Until{" "}
								{new Date(tenant.currentLease.endDate).toLocaleDateString()}
							</div>
						)}
					</div>
				) : (
					<div className="rounded-lg border border-dashed p-3 text-center text-muted-foreground text-sm">
						No active lease
					</div>
				)}
				{/* View CTA */}

				<Button variant="outline" size="lg" className="mt-2 w-full">
					<Link href={`/tenants/${tenant.id}` as Route}>View Details</Link>
				</Button>
				<DateRecordMeta
					createdAt={tenant.createdAt}
					updatedAt={tenant.updatedAt}
					className="pt-3"
				/>
			</CardContent>
		</Card>
	);
}
