// apps/web/src/app/(dashboard)/leases/page.tsx
"use client";

import { Button } from "@rently/ui/components/button";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { LeaseCard } from "@/components/features/leases/lease-card";
import { useDeleteLease, useLeases } from "@/hooks/leases";

type StatusFilter = "all" | "active" | "expired" | "terminated";

export default function LeasesPage() {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const { data, isLoading, isError, error } = useLeases();
	const deleteLease = useDeleteLease();

	const filtered = useMemo(() => {
		if (!data?.leases) return [];
		if (statusFilter === "all") return data.leases;
		return data.leases.filter((l) => l.status === statusFilter);
	}, [data?.leases, statusFilter]);

	if (isError) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				{error.message}
			</div>
		);
	}

	return (
		<div className="col-span-12 flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl">Leases</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Manage active and past rental agreements
					</p>
				</div>
				<Button size="lg">
					<Link href="/leases/new" className="flex items-center">
						<IconPlus className="mr-2 size-4" />
						New Lease
					</Link>
				</Button>
			</div>

			{/* Status filter tabs */}
			<div className="flex gap-2">
				{(["all", "active", "expired", "terminated"] as const).map((s) => (
					<Button
						key={s}
						variant={statusFilter === s ? "default" : "outline"}
						size="sm"
						onClick={() => setStatusFilter(s)}
						className="capitalize"
					>
						{s}
					</Button>
				))}
			</div>

			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
					))}
				</div>
			) : filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
					<p className="text-muted-foreground">
						{data?.leases.length === 0
							? "No leases yet. Create your first one!"
							: "No leases match this filter."}
					</p>
					{data?.leases.length === 0 && (
						<Button className="mt-4">
							<Link href="/leases/new">New Lease</Link>
						</Button>
					)}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((lease) => (
						<LeaseCard
							key={lease.leaseId}
							lease={lease}
							onDelete={(id) => deleteLease.mutate({ id })}
							isDeleting={
								deleteLease.isPending &&
								deleteLease.variables?.id === lease.leaseId
							}
						/>
					))}
				</div>
			)}
		</div>
	);
}
