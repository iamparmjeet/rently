// apps/web/src/app/(dashboard)/tenants/page.tsx
"use client";
// Uses useSuspenseProperties() — data is ALWAYS defined here.
// The Suspense boundary in page.tsx handles the loading state.
//

import type { InviteStatus } from "@rently/db/constants/rent-constants";
import { Button } from "@rently/ui/components/button";
import { IconMail, IconPlus } from "@tabler/icons-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { TenantCard } from "@/components/features/tenants/tenant-card";
import { PageHeader } from "@/components/shared/page-header";
import { useSuspenseTenants } from "@/hooks/tenants";

// type StatusFilter = ["All", ...InviteStatus] as const;
type StatusFilter = "all" | InviteStatus;

export default function TenantsClientPage() {
	const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

	const { data } = useSuspenseTenants();
	const filtered = useMemo(() => {
		if (!data?.tenants) return [];
		if (statusFilter === "all") return data.tenants;
		return data.tenants.filter((t) => t.status === statusFilter);
	}, [data?.tenants, statusFilter]);

	return (
		<div className="col-span-12 flex flex-col gap-6">
			{/* Header */}
			<PageHeader
				title="Tenants"
				description="Manage your tenants and their rental agreements"
			>
				{/* WHY only invite, not "Add Manually"?
                  The /tenants/new page doesn't exist yet.
                  Rather than a dead link, we only show what works.
                  TODO: add /tenants/new page and re-add the button */}
				<Button
					nativeButton={false}
					variant="outline"
					render={<Link href="/tenants/invites" />}
				>
					<IconMail className="mr-2 size-4" />
					Invite Tenant
				</Button>
				<Button
					size="lg"
					render={<Link href="/tenants/new" className="flex items-center" />}
					nativeButton={false}
				>
					<IconPlus className="mr-2 size-4" />
					Add Manually
				</Button>
			</PageHeader>

			{/* Status filter tabs */}
			<div className="flex gap-2">
				{(["all", "active", "pending", "expired"] as const).map((s) => (
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
			{filtered.length === 0 ? (
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
