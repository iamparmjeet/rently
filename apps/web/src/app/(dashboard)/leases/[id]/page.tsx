// apps/web/src/app/(dashboard)/leases/[id]/page.tsx
"use client";

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconArrowLeft, IconPencil, IconTrash } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use } from "react";
import LeaseStatusBadge from "@/components/features/leases/lease-status-badge";
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

	if (isLoading) {
		return (
			<div className="col-span-12 space-y-4">
				<div className="h-8 w-48 animate-pulse rounded bg-muted" />
				<div className="h-40 animate-pulse rounded-xl bg-muted" />
			</div>
		);
	}

	if (!data?.lease) {
		return (
			<div className="col-span-12 py-20 text-center text-muted-foreground">
				Lease not found.
			</div>
		);
	}

	const { lease } = data;

	return (
		<div className="col-span-12 space-y-6">
			{/*Header*/}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-3">
					<Button variant="ghost" size="icon">
						<Link href="/leases">
							<IconArrowLeft className="size-4" />
						</Link>
					</Button>
					<h1 className="font-semibold text-xl">Lease Details</h1>
					<p className="text-muted-foreground text-sm">ID: {id}</p>
				</div>
				<div>
					<Button variant="outline">
						<Link href={`/leases/${id}/edit`} className="flex items-center">
							<IconPencil className="mr-2 size-4" />
							Edit
						</Link>
					</Button>
					<Button
						variant="destructive"
						onClick={handleDelete}
						disabled={deleteLease.isPending}
					>
						<IconTrash className="size-4" />
						{deleteLease.isPending ? "Deleting..." : "Delete"}
					</Button>
				</div>
			</div>
			{/*Main Details*/}
			<LeaseDetailPage lease={lease} />
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

			{/* Payments + Utilities stubs — implement in next session */}
			{/* Payments stub */}
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Payments</CardTitle>
				</CardHeader>
				<CardContent className="py-8 text-center text-muted-foreground text-sm">
					Payment history — coming soon
				</CardContent>
			</Card>

			{/* Utilities stub */}
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
