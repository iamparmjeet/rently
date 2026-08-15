"use client";

import type { TenantListItem } from "@rently/validators";
import { IconUser } from "@tabler/icons-react";
import Link from "next/link";
import { useTenants } from "@/hooks/tenants";

type TenantStatus = TenantListItem["status"];

const STATUS_CONFIG: Record<
	TenantStatus,
	{
		label: string;
		dotClass: string;
		textClass: string;
		bgClass: string;
	}
> = {
	accepted: {
		label: "Active",
		dotClass: "bg-emerald-500",
		textClass: "text-emerald-700",
		bgClass: "bg-emerald-50",
	},
	pending: {
		label: "Pending",
		dotClass: "bg-amber-400",
		textClass: "text-amber-700",
		bgClass: "bg-amber-50",
	},
	expired: {
		label: "Expired",
		dotClass: "bg-slate-400",
		textClass: "text-slate-600",
		bgClass: "bg-slate-100",
	},
};

const PREVIEW_COUNT = 5;

interface RecentTenantsProps {
	className?: string;
}

function TenantRowSkeleton({ delay }: { delay: number }) {
	return (
		<div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3.5">
			<div className="flex items-center gap-3">
				<div
					className="size-9 shrink-0 animate-pulse rounded-xl bg-muted"
					style={{ animationDelay: `${delay}ms` }}
				/>
				<div className="space-y-1.5">
					<div
						className="h-3 w-28 animate-pulse rounded bg-muted"
						style={{ animationDelay: `${delay}ms` }}
					/>
					<div
						className="h-3 w-36 animate-pulse rounded bg-muted/60"
						style={{ animationDelay: `${delay + 50}ms` }}
					/>
				</div>
			</div>
			<div
				className="h-3 w-24 animate-pulse rounded bg-muted"
				style={{ animationDelay: `${delay}ms` }}
			/>
			<div
				className="h-5 w-14 animate-pulse rounded-full bg-muted"
				style={{ animationDelay: `${delay}ms` }}
			/>
		</div>
	);
}

export function RecentTenants({ className = "" }: RecentTenantsProps) {
	const { data, isLoading } = useTenants();

	const recent = [...(data?.tenants ?? [])]
		.sort(
			(a, b) =>
				new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
		)
		.slice(0, PREVIEW_COUNT);

	return (
		<div
			className={`overflow-hidden rounded-xl border bg-card shadow-sm ${className}`}
		>
			<div className="border-b bg-gradient-to-br from-primary/[0.10] via-primary/[0.025] to-transparent px-5 pt-5 pb-4">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-[10px] text-muted-foreground uppercase tracking-[0.14em]">
							People
						</p>
						<h3 className="mt-0.5 font-semibold text-sm">Recent tenants</h3>
					</div>
					<Link
						href="/tenants"
						className="text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						View all →
					</Link>
				</div>
			</div>

			<div className="px-5">
				<div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 border-b py-3">
					<span className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
						Tenant
					</span>
					<span className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
						Property
					</span>
					<span className="text-muted-foreground text-xs uppercase tracking-[0.14em]">
						Status
					</span>
				</div>

				<div className="flex flex-col divide-y">
					{isLoading ? (
						Array.from({ length: PREVIEW_COUNT }).map((_, i) => (
							<TenantRowSkeleton key={i} delay={i * 100} />
						))
					) : recent.length === 0 ? (
						<p className="py-8 text-center text-muted-foreground text-sm">
							No tenants yet — invite your first one to get started.
						</p>
					) : (
						recent.map((tenant) => {
							const statusCfg = STATUS_CONFIG[tenant.status];

							return (
								<div
									key={tenant.id}
									className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3.5"
								>
									<div className="flex min-w-0 items-center gap-3">
										<div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
											<IconUser className="size-4" />
										</div>
										<div className="min-w-0">
											<p className="truncate font-medium text-sm">
												{tenant.name}
											</p>
											<p className="truncate text-muted-foreground text-xs">
												{tenant.email}
											</p>
										</div>
									</div>

									<span className="max-w-36 truncate text-muted-foreground text-sm">
										{tenant.currentLease?.propertyName ?? "—"}
									</span>

									<span
										className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 font-medium text-xs ${statusCfg.bgClass} ${statusCfg.textClass}`}
									>
										<span
											className={`size-1.5 shrink-0 rounded-full ${statusCfg.dotClass}`}
										/>
										{statusCfg.label}
									</span>
								</div>
							);
						})
					)}
				</div>
			</div>
		</div>
	);
}
