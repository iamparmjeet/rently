// apps/web/src/app/(dashboard)/leases/[id]/page.tsx
"use client";

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconPencil, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import { LeaseDetails } from "@/components/features/leases/lease-details";
import LeaseStatusBadge from "@/components/features/leases/lease-status-badge";
import { DetailHeader } from "@/components/shared/detail-header";
import { NotFoundState } from "@/components/shared/not-found-state";
import { PageLoader } from "@/components/shared/page-loader";
import { useDeleteLease, useLease } from "@/hooks/leases";

export default function LeaseDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = use(params);
	const router = useRouter();
	const { data, isLoading } = useLease(id);
	const deleteLease = useDeleteLease();

	function handleDelete() {
		deleteLease.mutate({ id }, { onSuccess: () => router.push("/leases") });
	}

	if (isLoading) return <PageLoader rows={2} />;

	if (!data?.lease) return <NotFoundState message="Lease not found." />;

	const { lease } = data;

	return (
		<div className="col-span-12 space-y-6">
			{/*Header*/}
			<DetailHeader
				backHref="/leases"
				title="Lease Details"
				subtitle={`ID: ${id}`}
			>
				<Button
					nativeButton={false}
					variant="outline"
					render={<Link href={`/leases/${id}/edit`} />}
				>
					<IconPencil className="mr-2 size-4" />
					Edit
				</Button>
				<Button
					variant="destructive"
					onClick={handleDelete}
					disabled={deleteLease.isPending}
				>
					<IconTrash className="mr-2 size-4" />
					{deleteLease.isPending ? "Deleting..." : "Delete"}
				</Button>
			</DetailHeader>
			{/*Main Details*/}
			<LeaseDetails lease={lease} />
			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<CardTitle className="text-base">Agreement</CardTitle>
						<LeaseStatusBadge status={lease.status} />
					</div>
				</CardHeader>
				<CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
					<div>
						<p className="text-muted-foreground text-xs">Monthly Rent</p>
						<p className="font-semibold text-2xl">
							₹{lease.rent.toLocaleString("en-IN")}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Deposit</p>
						<p className="font-semibold text-2xl">
							{lease.deposit
								? `₹${lease.deposit.toLocaleString("en-IN")}`
								: "—"}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">Start Date</p>
						<p className="font-semibold">
							{new Date(lease.startDate).toLocaleDateString("en-IN")}
						</p>
					</div>
					<div>
						<p className="text-muted-foreground text-xs">End Date</p>
						<p className="font-semibold">
							{lease.endDate
								? new Date(lease.endDate).toLocaleDateString("en-IN")
								: "Ongoing"}
						</p>
					</div>
				</CardContent>
			</Card>

			{/* TODO: Payments + Utilities stubs — implement in next session */}
			{/* Payments stub */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Payments</CardTitle>
				</CardHeader>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					Payment history — coming soon
				</CardContent>
			</Card>

			{/* TODO: Utilities stub */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Utility Readings</CardTitle>
				</CardHeader>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					Utility readings — coming soon
				</CardContent>
			</Card>
		</div>
	);
}
