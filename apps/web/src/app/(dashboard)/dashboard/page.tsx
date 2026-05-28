// src/app/(dashboard)/dashboard/page.tsx
"use client";

import {
	IconArrowUpRight,
	IconBuildingSkyscraper,
	IconFileText,
	IconHome2,
	IconKey,
	IconPlus,
	IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useDashboardStats } from "@/hooks/dashboard";

// ─── Constants ───────────────────────────────────────────────

// WHY: static decorative data — chart is a placeholder until
// payment router migrates to oRPC and real data is available.
const CHART_HEIGHTS = [38, 55, 44, 72, 50, 65, 58, 88, 45, 70, 82, 92];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

// ─── Occupancy Ring ──────────────────────────────────────────

const RING_RADIUS = 46;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS; // ≈ 289

// WHY: Derived on the backend, returned as an integer 0-100.
// We translate it here into a strokeDashoffset for the SVG ring.
function ringColor(rate: number): string {
	if (rate >= 80) return "#10b981"; // emerald-500
	if (rate >= 50) return "#f59e0b"; // amber-500
	return "#ef4444"; // rose-500
}

function ringTextClass(rate: number): string {
	if (rate >= 80) return "text-emerald-500";
	if (rate >= 50) return "text-amber-500";
	return "text-rose-500";
}

function OccupancyRing({
	rate,
	isLoading,
}: {
	rate: number;
	isLoading: boolean;
}) {
	const offset = isLoading
		? RING_CIRCUMFERENCE
		: RING_CIRCUMFERENCE * (1 - rate / 100);

	return (
		<div className="relative inline-flex shrink-0 items-center justify-center">
			<svg
				width={108}
				height={108}
				viewBox="0 0 108 108"
				// WHY: SVG draws from 3 o'clock — rotate -90deg to start at 12 o'clock
				style={{ transform: "rotate(-90deg)" }}
				aria-hidden="true"
			>
				{/* Track */}
				<circle
					cx={54}
					cy={54}
					r={RING_RADIUS}
					fill="none"
					strokeWidth={7}
					className="stroke-muted"
				/>
				{/* Fill */}
				<circle
					cx={54}
					cy={54}
					r={RING_RADIUS}
					fill="none"
					strokeWidth={7}
					strokeLinecap="round"
					stroke={isLoading ? "transparent" : ringColor(rate)}
					strokeDasharray={RING_CIRCUMFERENCE}
					strokeDashoffset={offset}
					// WHY: CSS transition on strokeDashoffset gives the sweep animation
					// without needing a JS animation library
					style={{
						transition: "stroke-dashoffset 1.2s cubic-bezier(0.4,0,0.2,1)",
					}}
				/>
			</svg>

			{/* Centred label — rotated back to normal */}
			<div className="absolute flex flex-col items-center">
				{isLoading ? (
					<div className="h-6 w-12 animate-pulse rounded-md bg-muted" />
				) : (
					<span
						className={`font-bold text-xl tabular-nums leading-none ${ringTextClass(rate)}`}
					>
						{rate}%
					</span>
				)}
				<span className="mt-0.5 text-[10px] text-muted-foreground leading-none">
					filled
				</span>
			</div>
		</div>
	);
}

// ─── Unit Split Bar ───────────────────────────────────────────

function UnitSplitBar({
	occupied,
	total,
	isLoading,
}: {
	occupied: number;
	total: number;
	isLoading: boolean;
}) {
	const pct = total > 0 ? (occupied / total) * 100 : 0;

	return (
		<div className="mt-auto flex flex-col gap-2">
			<div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
				{isLoading ? (
					<div className="h-full w-1/2 animate-pulse rounded-full bg-muted-foreground/20" />
				) : (
					<div
						className="absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-1000 ease-out"
						style={{ width: `${pct}%` }}
					/>
				)}
			</div>

			<div className="flex justify-between text-muted-foreground text-xs">
				{isLoading ? (
					<>
						<div className="h-3 w-20 animate-pulse rounded bg-muted" />
						<div className="h-3 w-20 animate-pulse rounded bg-muted" />
					</>
				) : (
					<>
						<span>
							<span className="font-medium text-foreground tabular-nums">
								{occupied}
							</span>{" "}
							occupied
						</span>
						<span>
							<span className="font-medium text-foreground tabular-nums">
								{total - occupied}
							</span>{" "}
							available
						</span>
					</>
				)}
			</div>
		</div>
	);
}

// ─── Shared Skeleton ──────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
	return (
		<div className={`animate-pulse rounded-lg bg-muted ${className ?? ""}`} />
	);
}

// ─── Stat Number ─────────────────────────────────────────────

function StatNumber({
	value,
	isLoading,
	inverted = false,
}: {
	value: number;
	isLoading: boolean;
	inverted?: boolean;
}) {
	if (isLoading) {
		return (
			<div
				className={`h-12 w-20 animate-pulse rounded-lg ${inverted ? "bg-white/20" : "bg-muted"}`}
			/>
		);
	}
	return (
		<p className="font-bold text-5xl tabular-nums leading-none tracking-tight">
			{value}
		</p>
	);
}

// ─── Main Page ────────────────────────────────────────────────

export default function DashboardPage() {
	const { data, isLoading } = useDashboardStats();

	const today = new Date().toLocaleDateString("en-IN", {
		weekday: "long",
		day: "numeric",
		month: "long",
	});

	return (
		<>
			{/* ── Page header ─ */}
			<div className="col-span-12 flex items-start justify-between">
				<div>
					<p className="text-muted-foreground text-sm">{today}</p>
					<h1 className="mt-1 font-semibold text-2xl tracking-tight">
						Portfolio Overview
					</h1>
				</div>
				<Link
					href="/properties/new"
					className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 font-medium text-primary-foreground text-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
				>
					<IconPlus className="size-4" />
					New Property
				</Link>
			</div>

			{/* ── Properties ───────────────────────── col-3 */}
			<div className="relative col-span-3 overflow-hidden rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				{/* Decorative geometry */}
				<div className="pointer-events-none absolute -top-7 -right-7 size-32 rounded-full bg-primary/5" />
				<div className="pointer-events-none absolute -top-2 -right-2 size-16 rounded-full bg-primary/8" />

				<div className="relative flex items-start justify-between">
					<div className="rounded-xl bg-primary/10 p-2.5">
						<IconBuildingSkyscraper className="size-5 text-primary" />
					</div>
					<Link
						href="/properties"
						className="group flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						View all
						<IconArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
					</Link>
				</div>

				<div className="relative mt-5">
					<StatNumber
						value={data?.totalProperties ?? 0}
						isLoading={isLoading}
					/>
					<p className="mt-1.5 font-medium text-muted-foreground text-sm">
						Properties
					</p>
				</div>
			</div>

			{/* ── Units with split bar ─────────────── col-3 */}
			<div className="col-span-3 flex flex-col rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				<div className="flex items-start justify-between">
					<div className="rounded-xl bg-blue-500/10 p-2.5">
						<IconHome2 className="size-5 text-blue-500" />
					</div>
					<Link
						href="/units"
						className="group flex items-center gap-1 text-muted-foreground text-xs transition-colors hover:text-foreground"
					>
						View all
						<IconArrowUpRight className="size-3 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
					</Link>
				</div>

				<div className="mt-5">
					<StatNumber value={data?.totalUnits ?? 0} isLoading={isLoading} />
					<p className="mt-1.5 font-medium text-muted-foreground text-sm">
						Total Units
					</p>
				</div>

				{/* WHY: UnitSplitBar lives inside the flex column —
				    mt-auto pushes it to the bottom of the card */}
				<UnitSplitBar
					occupied={data?.occupiedUnits ?? 0}
					total={data?.totalUnits ?? 0}
					isLoading={isLoading}
				/>
			</div>

			{/* ── Occupancy ring ───────────────────── col-3 */}
			<div className="col-span-3 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				<div className="flex items-start justify-between">
					<div className="rounded-xl bg-emerald-500/10 p-2.5">
						<IconUsers className="size-5 text-emerald-500" />
					</div>
					<span className="text-muted-foreground text-xs">Occupancy rate</span>
				</div>

				<div className="mt-4 flex items-center gap-5">
					<OccupancyRing
						rate={data?.occupancyRate ?? 0}
						isLoading={isLoading}
					/>

					<div className="flex flex-col gap-3.5">
						<div>
							<p className="text-[10px] text-muted-foreground uppercase tracking-widest">
								Occupied
							</p>
							{isLoading ? (
								<Skeleton className="mt-1.5 h-6 w-10" />
							) : (
								<p className="font-semibold text-xl tabular-nums leading-none">
									{data?.occupiedUnits ?? 0}
								</p>
							)}
						</div>
						<div>
							<p className="text-[10px] text-muted-foreground uppercase tracking-widest">
								Available
							</p>
							{isLoading ? (
								<Skeleton className="mt-1.5 h-6 w-10" />
							) : (
								<p className="font-semibold text-xl tabular-nums leading-none">
									{data?.availableUnits ?? 0}
								</p>
							)}
						</div>
					</div>
				</div>
			</div>

			{/* ── Active Leases — accent ───────────── col-3 */}
			<div className="relative col-span-3 overflow-hidden rounded-2xl bg-primary p-6 text-primary-foreground shadow-lg shadow-primary/20">
				{/* Decorative geometry */}
				<div className="pointer-events-none absolute -right-5 -bottom-5 size-28 rounded-full bg-white/8" />
				<div className="pointer-events-none absolute right-6 -bottom-10 size-16 rounded-full bg-white/5" />

				<div className="relative flex items-start justify-between">
					<div className="rounded-xl bg-white/15 p-2.5">
						<IconFileText className="size-5" />
					</div>
					<Link
						href="/leases"
						className="flex items-center gap-1 text-primary-foreground/70 text-xs transition-colors hover:text-primary-foreground"
					>
						View all
						<IconArrowUpRight className="size-3" />
					</Link>
				</div>

				<div className="relative mt-5">
					<StatNumber
						value={data?.activeLeases ?? 0}
						isLoading={isLoading}
						inverted
					/>
					<p className="mt-1.5 font-medium text-sm opacity-75">Active Leases</p>
				</div>
			</div>

			{/* ── Revenue chart ────────────────────── col-8 row-span-2 */}
			<div className="col-span-8 row-span-2 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				<div className="flex items-start justify-between">
					<div>
						<h2 className="font-semibold text-base">Revenue Overview</h2>
						<p className="mt-0.5 text-muted-foreground text-sm">
							Monthly rent collection across all properties
						</p>
					</div>
					<span className="rounded-lg bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs">
						Coming soon
					</span>
				</div>

				{/* WHY: Decorative chart gives visual structure to the empty state —
				    it shows what the space is for, not just a blank placeholder */}
				<div
					className="mt-6 flex items-end gap-1.5"
					style={{ height: "calc(100% - 7rem)" }}
				>
					{CHART_HEIGHTS.map((h, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static decorative bars, order never changes
						<div key={i} className="group flex flex-1 flex-col">
							<div
								className="w-full rounded-t-md border-primary/25 border-t-2 bg-primary/8 transition-colors duration-300 group-hover:border-primary/50 group-hover:bg-primary/15"
								style={{ height: `${h}%` }}
							/>
						</div>
					))}
				</div>

				<div className="mt-2 flex gap-1.5">
					{MONTHS.map((m) => (
						<p
							key={m}
							className="flex-1 text-center text-[11px] text-muted-foreground"
						>
							{m}
						</p>
					))}
				</div>
			</div>

			{/* ── Quick Actions ─────────────────────── col-4 */}
			<div className="col-span-4 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				<h3 className="font-semibold text-sm">Quick Actions</h3>

				<div className="mt-4 flex flex-col gap-2">
					{(
						[
							{
								href: "/units/new",
								label: "Add Unit",
								sub: "Create a rentable unit",
								icon: IconHome2,
								iconClass: "text-blue-500",
								bgClass: "bg-blue-500/10",
							},
							{
								href: "/tenants/new",
								label: "Add Tenant",
								sub: "Onboard a new tenant",
								icon: IconUsers,
								iconClass: "text-emerald-500",
								bgClass: "bg-emerald-500/10",
							},
							{
								href: "/leases/new",
								label: "New Lease",
								sub: "Create a lease agreement",
								icon: IconKey,
								iconClass: "text-primary",
								bgClass: "bg-primary/10",
							},
						] as const
					).map(({ href, label, sub, icon: Icon, iconClass, bgClass }) => (
						<Link
							key={href}
							href={href}
							className="group flex items-center gap-3 rounded-xl border border-border/30 bg-muted/20 p-3 transition-all hover:border-border/60 hover:bg-muted/50"
						>
							<div className={`rounded-lg p-2 transition-colors ${bgClass}`}>
								<Icon className={`size-4 ${iconClass}`} />
							</div>
							<div className="min-w-0 flex-1">
								<p className="font-medium text-sm">{label}</p>
								<p className="truncate text-muted-foreground text-xs">{sub}</p>
							</div>
							<IconArrowUpRight className="size-4 shrink-0 text-muted-foreground/40 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-muted-foreground" />
						</Link>
					))}
				</div>
			</div>

			{/* ── Portfolio Health ──────────────────── col-4 */}
			<div className="col-span-4 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				<h3 className="font-semibold text-sm">Portfolio Health</h3>

				<div className="mt-4 flex flex-col gap-2">
					{(
						[
							{
								label: "Occupied units",
								value: data?.occupiedUnits,
								dotClass: "bg-emerald-500",
							},
							{
								label: "Vacant units",
								value: data?.availableUnits,
								dotClass: "bg-amber-500",
							},
							{
								label: "Active leases",
								value: data?.activeLeases,
								dotClass: "bg-primary",
							},
							{
								label: "Properties",
								value: data?.totalProperties,
								dotClass: "bg-blue-500",
							},
						] as const
					).map(({ label, value, dotClass }) => (
						<div
							key={label}
							className="flex items-center justify-between rounded-xl bg-muted/30 px-3 py-2.5"
						>
							<div className="flex items-center gap-2.5">
								<div className={`size-2 shrink-0 rounded-full ${dotClass}`} />
								<span className="text-sm">{label}</span>
							</div>
							{isLoading ? (
								<Skeleton className="h-4 w-8" />
							) : (
								<span className="font-semibold text-sm tabular-nums">
									{value ?? 0}
								</span>
							)}
						</div>
					))}
				</div>
			</div>

			{/* ── Recent Transactions ───────────────── col-12 */}
			<div className="col-span-12 rounded-2xl border border-border/40 bg-card p-6 shadow-sm">
				<div className="flex items-center justify-between">
					<div>
						<h3 className="font-semibold text-base">Recent Transactions</h3>
						<p className="mt-0.5 text-muted-foreground text-sm">
							Latest rent and payment activity
						</p>
					</div>
					<span className="rounded-lg bg-muted/60 px-3 py-1.5 text-muted-foreground text-xs">
						Coming soon
					</span>
				</div>

				{/* Skeleton rows — staggered delay gives a "wave" loading feel */}
				<div className="mt-4 flex flex-col divide-y divide-border/40">
					{Array.from({ length: 4 }).map((_, i) => (
						// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton, order never changes
						<div key={i} className="flex items-center gap-4 py-3.5">
							<div
								className="size-9 animate-pulse rounded-full bg-muted"
								style={{ animationDelay: `${i * 120}ms` }}
							/>
							<div className="flex-1 space-y-2">
								<div
									className="h-3 w-36 animate-pulse rounded bg-muted"
									style={{ animationDelay: `${i * 120}ms` }}
								/>
								<div
									className="h-3 w-24 animate-pulse rounded bg-muted/60"
									style={{ animationDelay: `${i * 120 + 60}ms` }}
								/>
							</div>
							<div
								className="h-3 w-20 animate-pulse rounded bg-muted"
								style={{ animationDelay: `${i * 120}ms` }}
							/>
						</div>
					))}
				</div>
			</div>
		</>
	);
}
