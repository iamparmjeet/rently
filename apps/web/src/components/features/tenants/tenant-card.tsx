// apps/web/src/components/features/tenants/tenant-card.tsx
"use client";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent, CardHeader } from "@rently/ui/components/card";
import {
	IconBuilding,
	IconMail,
	IconPhone,
	IconUser,
} from "@tabler/icons-react";
import Link from "next/link";

// Exported so TenantCardActions can reuse without re-declaring
export interface Tenant {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	status: "active" | "pending" | "expired" | "accepted";
	currentLease: {
		id: string;
		propertyName: string;
		unitNumber: string;
		rent: number;
		endDate: string | null;
	} | null;
	avatarUrl: string | null;
}

interface TenantCardProps {
	tenant: Tenant;
	// Render slot — TenantCardActions injects the DropdownMenu here
	// Keeps the card dumb: it displays, actions component orchestrates
	actionsSlot?: React.ReactNode;
}

const statusVariants = {
	active: "default",
	accepted: "default",
	pending: "secondary",
	expired: "outline",
} as const;

export function TenantCard({ tenant, actionsSlot }: TenantCardProps) {
	return (
		<Card className="flex flex-col">
			<CardHeader className="flex-row items-start gap-4 space-y-0 pb-2">
				<div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-muted">
					{tenant.avatarUrl ? (
						<img
							src={tenant.avatarUrl}
							alt={tenant.name}
							className="size-full rounded-full object-cover"
						/>
					) : (
						<IconUser className="size-6 text-muted-foreground" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<h3 className="truncate font-semibold">{tenant.name}</h3>
					<Badge variant={statusVariants[tenant.status]} className="mt-1">
						{tenant.status}
					</Badge>
				</div>
				{/* Action menu injected by parent */}
				{actionsSlot}
			</CardHeader>
			<CardContent className="flex flex-1 flex-col gap-3">
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
				<div className="mt-auto pt-2">
					<Button variant="outline" size="sm" className="w-full">
						<Link href={`/tenants/${tenant.id}`}>View Details</Link>
					</Button>
				</div>
			</CardContent>
		</Card>
	);
}
