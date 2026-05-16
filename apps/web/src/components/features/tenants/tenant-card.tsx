// apps/web/src/components/features/tenants/tenant-card.tsx
"use client";

import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent, CardHeader } from "@rently/ui/components/card";
import {
	IconArchive,
	IconBuilding,
	IconLoader2,
	IconMail,
	IconPhone,
	IconUser,
} from "@tabler/icons-react";
import Link from "next/link";

interface Tenant {
	id: string;
	name: string;
	email: string;
	phone: string | null;
	status: "active" | "pending" | "inactive";
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
	onArchive?: (id: string) => void;
	isArchiving?: boolean;
}

const statusVariants = {
	active: "default",
	pending: "secondary",
	inactive: "outline",
} as const;

export function TenantCard({
	tenant,
	onArchive,
	isArchiving,
}: TenantCardProps) {
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
							{tenant.currentLease.rent.toLocaleString()}
							/mo
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

				{/* Actions */}
				<div className="mt-auto flex gap-2 pt-2">
					<Button variant="outline" size="sm" className="flex-1" asChild>
						<Link href={`/tenants/${tenant.id}`}>View</Link>
					</Button>
					{onArchive && (
						<Button
							variant="outline"
							size="sm"
							className="shrink-0"
							onClick={() => onArchive(tenant.id)}
							disabled={isArchiving}
						>
							{isArchiving ? (
								<IconLoader2 className="size-4 animate-spin" />
							) : (
								<IconArchive className="size-4" />
							)}
						</Button>
					)}
				</div>
			</CardContent>
		</Card>
	);
}
