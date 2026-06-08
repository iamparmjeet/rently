"use client";

import type { TenantListItem } from "@rently/validators";
import Link from "next/link";
import { useTenants } from "@/hooks/tenants";

// ── Avatar helpers ──
const AVATAR_PALETTES = [
	"bg-blue-100 text-blue-700",
	"bg-violet-100 text-violet-700",
	"bg-emerald-100 text-emerald-700",
	"bg-rose-100 text-rose-700",
	"bg-amber-100 text-amber-700",
	"bg-cyan-100 text-cyan-700",
	"bg-pink-100 text-pink-700",
	"bg-indigo-100 text-indigo-700",
] as const;

function getAvatarPalette(name: string): string {
	const code = name.charCodeAt(0);

	return AVATAR_PALETTES[code % AVATAR_PALETTES.length] ?? AVATAR_PALETTES[0];
}

function getInitials(name: string): string {
	return name
		.split(" ")
		.map((word) => word[0] ?? "")
		.join("")
		.toUpperCase()
		.slice(0, 2);
}

// ── Status badge config ──
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

// ── Skeleton row ─────────────────────
function TenantRowSkeleton({ delay }: { delay: number }) {
	return (
		<div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3.5">
			<div className="flex items-center gap-3">
				<div
					className="size-9 shrink-0 animate-pulse rounded-full bg-muted"
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
			className={`rounded-2xl border border-border/40 bg-card p-6 shadow-sm ${className}`}
		>
			{/* ── Header ───────────── */}
			<div className="flex items-center justify-between">
				<h3 className="font-semibold text-base">Recent Tenants</h3>
				<Link
					href="/tenants"
					className="text-muted-foreground text-sm transition-colors hover:text-foreground"
				>
					View all →
				</Link>
			</div>

			{/* ── Column headers ────── */}
			<div className="mt-4 grid grid-cols-[1fr_auto_auto] items-center gap-4 border-border/40 border-b pb-2">
				<span className="text-muted-foreground text-xs uppercase tracking-wide">
					Tenant
				</span>
				<span className="text-muted-foreground text-xs uppercase tracking-wide">
					Property
				</span>
				<span className="text-muted-foreground text-xs uppercase tracking-wide">
					Status
				</span>
			</div>

			{/* ── Rows ────────────── */}
			<div className="flex flex-col divide-y divide-border/40">
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
								{/* Avatar + name / email ──────────────────── */}
								<div className="flex min-w-0 items-center gap-3">
									<div
										className={`flex size-9 shrink-0 items-center justify-center rounded-full font-semibold text-xs ${getAvatarPalette(tenant.name)}`}
									>
										{getInitials(tenant.name)}
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

								{/* Property name ─────── */}

								<span className="max-w-36 truncate text-muted-foreground text-sm">
									{tenant.currentLease?.propertyName ?? "—"}
								</span>

								{/* Status badge ───────── */}
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
	);
}
