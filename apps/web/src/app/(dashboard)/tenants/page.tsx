// apps/web/src/app/(dashboard)/tenants/page.tsx
"use client";

import { Button } from "@rently/ui/components/button";
import { IconMail, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TenantCard } from "@/components/features/tenants/tenant-card";
import { useTenants } from "@/hooks/tenants";

type StatusFilter = "all" | "active" | "pending" | "inactive";

export default function TenantsPage() {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const { data, isLoading, isError, error } = useTenants();

	const filtered = useMemo(() => {
		if (!data?.tenants) return [];
		if (statusFilter === "all") return data.tenants;
		return data.tenants.filter((t) => t.status === statusFilter);
	}, [data?.tenants, statusFilter]);

	if (isError) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				{error.message}
			</div>
		);
	}

	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<div>
					<h1 className="font-semibold text-2xl">Tenants</h1>
					<p className="mt-0.5 text-muted-foreground text-sm">
						Manage your tenants and their rental agreements
					</p>
				</div>
				<div className="flex gap-2">
					<Button variant="outline" size="lg">
						<Link href="/tenants/invite" className="flex items-center">
							<IconMail className="mr-2 size-4" />
							Invite Tenant
						</Link>
					</Button>
					<Button size="lg">
						<Link href="/tenants/new" className="flex items-center">
							<IconPlus className="mr-2 size-4" />
							Add Manually
						</Link>
					</Button>
				</div>
			</div>

			{/* Status filter tabs */}
			<div className="flex gap-2">
				{(["all", "active", "pending", "inactive"] as const).map((s) => (
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

			{/* Content states */}
			{isLoading ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />
					))}
				</div>
			) : filtered.length === 0 ? (
				<div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-16 text-center">
					<p className="text-muted-foreground">
						{data?.tenants.length === 0
							? "No tenants yet. Invite your first one!"
							: "No tenants match this filter."}
					</p>
					{data?.tenants.length === 0 && (
						<div className="mt-4 flex gap-2">
							<Button variant="outline">
								<Link href="/tenants/invite">Invite Tenant</Link>
							</Button>
							<Button>
								<Link href="/tenants/new">Add Manually</Link>
							</Button>
						</div>
					)}
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{filtered.map((tenant) => (
						<TenantCard key={tenant.id} tenant={tenant} />
					))}
				</div>
			)}
		</div>
	);
}
