import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
} from "@rently/ui/components/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { formatRupees } from "@rently/ui/lib/currency";
import { cn } from "@rently/ui/lib/utils";
import { DateRecordMeta } from "@rently/ui/shared/date-record-meta";
import type { LeaseWithDetails } from "@rently/validators";
import {
	IconCalendar,
	IconDots,
	IconPencil,
	IconTrash,
	IconUser,
} from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import LeaseStatusBadge from "./lease-status-badge";

interface LeaseCardProps {
	lease: LeaseWithDetails;
	onEdit?: (lease: LeaseWithDetails) => void;
	onDelete?: (id: string) => void;
	isDeleting?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export function LeaseCard({
	onEdit,
	lease,
	onDelete,
	isDeleting,
	createdAt,
	updatedAt,
}: LeaseCardProps) {
	const isTerminated = lease.status === "terminated";

	const startDate = new Date(lease.startDate).toLocaleDateString("en-IN", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	});

	const endDate = lease.endDate
		? new Date(lease.endDate).toLocaleDateString("en-IN", {
				day: "2-digit",
				month: "short",
				year: "numeric",
			})
		: "Ongoing";

	return (
		<Card
			className={cn(
				"transition-all hover:shadow-md",
				isDeleting && "pointer-events-none opacity-50",
			)}
		>
			<CardHeader className="pb-3">
				<div className="flex items-start justify-between gap-2">
					{/* Tenant */}
					<div className="flex flex-col gap-1.5">
						<span className="flex items-center gap-1.5 truncate font-medium text-sm">
							<IconUser className="size-3.5 shrink-0 text-muted-foreground" />
							{lease.tenantName ?? "Unknown Tenant"}
						</span>
						{lease.tenantEmail}
					</div>

					{/* Actions */}
					<DropdownMenu>
						<DropdownMenuTrigger
							render={
								<Button variant="ghost" size="icon" className="size-7 shrink-0">
									<IconDots className="size-4" />
									<span className="sr-only">Open Menu</span>
								</Button>
							}
						/>
						<DropdownMenuContent align="end">
							<DropdownMenuItem>
								<Link
									href={`/leases/${lease.leaseId}` as Route}
									className="flex items-center"
								>
									View Details
								</Link>
							</DropdownMenuItem>
							<DropdownMenuItem
								disabled={isTerminated}
								onClick={() => (onEdit ? onEdit(lease) : undefined)}
							>
								{onEdit ? (
									<>
										<IconPencil className="mr-2 size-4" />
										Edit
									</>
								) : (
									<Link
										href={`/leases/${lease.leaseId}/edit` as Route}
										className="flex items-center"
									>
										<IconPencil className="mr-2 size-4" />
										Edit
									</Link>
								)}
							</DropdownMenuItem>
							<DropdownMenuSeparator />
							<DropdownMenuItem
								disabled={isTerminated}
								className="text-destructive focus:text-destructive"
								onClick={() => onDelete?.(lease.leaseId)}
							>
								<IconTrash className="mr-2 size-4" />
								Delete
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</CardHeader>

			<CardContent className="space-y-3 pb-3">
				{/* Unit breadcrumb*/}
				<p className="text-muted-foreground text-xs">
					{lease.propertyName}
					<span className="text-foreground">
						-{">"} Unit{lease.unitNumber}
					</span>
				</p>

				{/* Rent*/}
				<p className="font-bold text-2xl">
					{formatRupees(lease.rent)}
					<span className="font-normal text-muted-foreground text-sm">/mo</span>
				</p>

				{/* Dates */}
				<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
					<IconCalendar className="size-3.5" />
					<span>
						{startDate} → {endDate}
					</span>
				</div>
			</CardContent>

			<CardFooter className="gap-2 pt-0">
				<LeaseStatusBadge status={lease.status} />
				<span className="ml-auto text-muted-foreground text-xs">
					Deposit: {lease.deposit == null ? "—" : formatRupees(lease.deposit)}
				</span>
			</CardFooter>
			<DateRecordMeta
				className="px-4"
				createdAt={createdAt}
				updatedAt={updatedAt}
			/>
		</Card>
	);
}
