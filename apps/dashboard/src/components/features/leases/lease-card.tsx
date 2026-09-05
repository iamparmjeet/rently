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
import type { LeaseWithDetails } from "@rently/validators";
import {
	IconArrowRight,
	IconBuilding,
	IconCalendar,
	IconDots,
	IconPencil,
	IconRefresh,
	IconTrash,
	IconUser,
} from "@tabler/icons-react";
import { format } from "date-fns";
import type { Route } from "next";
import Link from "next/link";
import LeaseStatusBadge from "./lease-status-badge";

interface LeaseCardProps {
	lease: LeaseWithDetails;
	onEdit?: (lease: LeaseWithDetails) => void;
	onReactivate?: (id: string) => void;
	onDelete?: (id: string) => void;
	isDeleting?: boolean;
	isReactivating?: boolean;
	createdAt: Date;
	updatedAt: Date;
}

export function LeaseCard({
	onEdit,
	lease,
	onReactivate,
	onDelete,
	isDeleting,
	isReactivating,
	createdAt,
	updatedAt,
}: LeaseCardProps) {
	const isTerminated = lease.status === "terminated";
	const isEditable =
		lease.status !== "active" &&
		lease.status !== "terminated" &&
		lease.status !== "expired";

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
				"gap-0 overflow-hidden border-border/80 py-0 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md",
				isDeleting && "pointer-events-none opacity-50",
			)}
		>
			<CardHeader className="border-b bg-linear-to-br from-primary/10 via-primary/2.5 to-transparent px-5 pt-5 pb-4">
				<div className="flex items-start justify-between gap-2">
					{/* Tenant */}
					<div className="flex min-w-0 items-start gap-3">
						<div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
							<IconUser className="size-5" />
						</div>
						<div className="min-w-0">
							<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
								Lease agreement
							</p>
							<span className="flex items-center gap-1.5 truncate font-medium text-sm">
								{lease.tenantName ?? "Unknown Tenant"}
							</span>
							<p className="mt-1 truncate text-muted-foreground text-xs">
								{lease.tenantEmail}
							</p>
						</div>
					</div>

					<div className="flex shrink-0 items-center gap-1">
						<LeaseStatusBadge status={lease.status} />
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="ghost"
										size="icon"
										className="size-7 shrink-0"
									>
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
								{isEditable && (
									<DropdownMenuItem
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
								)}
								{isTerminated && (
									<DropdownMenuItem
										disabled={isReactivating}
										onClick={() => onReactivate?.(lease.leaseId)}
									>
										<IconRefresh className="mr-2 size-4" />
										Reactivate
									</DropdownMenuItem>
								)}
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
				</div>
			</CardHeader>

			<CardContent className="space-y-4 px-5 py-4">
				<div className="flex items-start justify-between gap-3">
					<div className="min-w-0">
						<p className="text-muted-foreground text-xs">Monthly rent</p>
						<p className="mt-1 font-semibold text-xl tracking-tight">
							{formatRupees(lease.rent)}
							<span className="ml-1 font-normal text-muted-foreground text-xs">
								/mo
							</span>
						</p>
					</div>
					<div className="text-right">
						<p className="text-muted-foreground text-xs">Security deposit</p>
						<p className="mt-1 font-medium text-sm">
							{lease.deposit == null ? "—" : formatRupees(lease.deposit)}
						</p>
					</div>
				</div>
				<div className="rounded-lg border bg-muted/18 px-3 py-2.5">
					<div className="flex items-center gap-2 text-sm">
						<IconBuilding className="size-3.5 text-primary" />
						<span className="truncate font-medium">{lease.propertyName}</span>
						<span className="text-muted-foreground">·</span>
						<span className="shrink-0 text-muted-foreground">
							Unit {lease.unitNumber}
						</span>
					</div>
					<div className="mt-2 flex items-center gap-1.5 border-t pt-2 text-muted-foreground text-xs">
						<IconCalendar className="size-3.5" />
						<span>
							{startDate} → {endDate}
						</span>
					</div>
				</div>
			</CardContent>

			<CardFooter className="flex items-center justify-between gap-3 border-t px-5 py-3.5">
				<p className="min-w-0 truncate text-muted-foreground text-xs">
					<span className="whitespace-nowrap">
						Created {format(new Date(createdAt), "dd MMM yyyy")}
					</span>
					<span className="text-muted-foreground/60">&nbsp;·&nbsp;</span>
					<span className="whitespace-nowrap">
						Updated {format(new Date(updatedAt), "dd MMM yyyy")}
					</span>
				</p>
				<Button
					nativeButton={false}
					variant="ghost"
					size="sm"
					className="ml-auto shrink-0 text-primary"
					render={<Link href={`/leases/${lease.leaseId}` as Route} />}
				>
					Open <IconArrowRight className="size-3.5" />
				</Button>
			</CardFooter>
		</Card>
	);
}
