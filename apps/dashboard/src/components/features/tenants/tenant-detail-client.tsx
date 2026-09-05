"use client";

import { Button } from "@rently/ui/components/button";
import { formatRupees } from "@rently/ui/lib/currency";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import type {
	PaymentListItem,
	TenantDetail,
	UtilityListItem,
} from "@rently/validators";
import {
	IconBrandWhatsapp,
	IconPencil,
	IconRefresh,
	IconUserMinus,
} from "@tabler/icons-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useResendInvite } from "@/hooks/invites";
import { useLease } from "@/hooks/leases";
import { usePayments } from "@/hooks/payments";
import { useRemoveTenant, useTenant } from "@/hooks/tenants";
import { useUtilities } from "@/hooks/utilities";
import { DocumentsTab } from "./documents-tab";
import { EditTenantDialog } from "./edit-tenant-dialog";
import { OverviewTab } from "./overview-tab";
import { PaymentsTab } from "./payments-tab";
import { TenantDetailSkeleton } from "./tenant-detail-skelton";
import { UtilitiesTab } from "./utilities-tab";

// ***** Tab definitions ***************
const TABS = ["overview", "utilities", "payments", "documents"] as const;
type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
	overview: "Overview",
	utilities: "Utilities",
	payments: "Payments & Dues",
	documents: "Documents",
};

// *********** Stats computation **************

interface TenantStats {
	monthlyRent: number;
	thisMonthBill: number;
	totalPaidYTD: number;
	overdueAmount: number;
}

// WHY a pure function, not useMemo: computeStats has no side effects and
// doesn't need memoization itself — it's just a calculation. The memoization
// belongs at the *call site* inside the component (where the deps are known),
// not inside the function. Pure functions are easier to test and reason about.
function computeStats(
	tenant: TenantDetail,
	paymentsData: { payments: PaymentListItem[] } | undefined,
	utilitiesData: { utilities: UtilityListItem[] } | undefined,
): TenantStats {
	const activeLeaseIds = new Set(
		tenant.activeLeases.map((activeLease) => activeLease.id),
	);
	const monthlyRent = tenant.activeLeases.reduce(
		(sum, activeLease) => sum + activeLease.rent,
		0,
	);
	const now = new Date();
	const year = now.getFullYear();
	const month = now.getMonth();

	const leasePayments = (paymentsData?.payments ?? []).filter((p) =>
		activeLeaseIds.has(p.leaseId),
	);

	const totalPaidYTD = leasePayments
		.filter((p) => new Date(p.paymentDate).getFullYear() === year)
		.reduce((sum, p) => sum + p.amount, 0);

	const allUtils = utilitiesData?.utilities ?? [];
	const thisMonthBill =
		monthlyRent +
		allUtils
			.filter((u) => {
				const d = new Date(u.currentReadingDate);
				return d.getMonth() === month && d.getFullYear() === year;
			})
			.reduce((sum, u) => {
				const creditsSum = (u.credits ?? []).reduce((s, c) => s + c.amount, 0);
				return sum + u.totalAmount + creditsSum;
			}, 0);

	const periodStart = new Date(year, month, 1);
	const overdueAmount = allUtils
		.filter((u) => !u.isPaid && new Date(u.currentReadingDate) < periodStart)
		.reduce((sum, u) => sum + u.totalAmount, 0);

	return { monthlyRent, thisMonthBill, totalPaidYTD, overdueAmount };
}

// ******** Stat card ***********

function StatCard({
	label,
	value,
	variant = "default",
}: {
	label: string;
	value: string;
	variant?: "primary" | "default";
}) {
	return (
		<div
			className={`border-r p-4 last:border-r-0 sm:p-5 ${
				variant === "primary" ? "bg-primary/4 text-foreground" : "bg-card"
			}`}
		>
			<p
				className={`text-xs ${variant === "primary" ? "text-primary-foreground/70" : "text-muted-foreground"}`}
			>
				{label}
			</p>
			<p className="mt-1 font-semibold text-xl tracking-tight">{value}</p>
		</div>
	);
}

// ***** Tab nav ************

function TabNav({
	activeTab,
	onTabChange,
}: {
	activeTab: TabId;
	onTabChange: (tab: TabId) => void;
}) {
	return (
		<div className="flex overflow-x-auto border-b px-2">
			{TABS.map((tab) => (
				<button
					key={tab}
					type="button"
					onClick={() => onTabChange(tab)}
					className={`shrink-0 border-b-2 px-4 py-3 font-medium text-sm transition-colors ${
						activeTab === tab
							? "border-primary text-primary"
							: "border-transparent text-muted-foreground hover:text-foreground"
					}`}
				>
					{TAB_LABELS[tab]}
				</button>
			))}
		</div>
	);
}

//  Main component ****************

export default function TenantDetailClient({ id }: { id: string }) {
	const router = useRouter();
	const searchParams = useSearchParams();
	const [editOpen, setEditOpen] = useState(false);

	//  Parse + validate tab from URL search param
	// WHY validate: users can type any value in the URL — guard against it here
	// rather than letting every tab component handle bad input.
	const rawTab = searchParams.get("tab") ?? "overview";
	const activeTab: TabId = (TABS as readonly string[]).includes(rawTab)
		? (rawTab as TabId)
		: "overview";

	function setTab(tab: TabId) {
		// WHY replace not push: tab switches are not navigation history — pressing
		// back should go to /tenants, not cycle through previous tabs.
		router.replace(`/tenants/${id}?tab=${tab}`, { scroll: false });
	}

	//  Data fetching ─ ***********
	const { data, isLoading, isError, error } = useTenant(id);
	const tenant = data?.tenant;

	const primaryLeaseId = tenant?.activeLeases[0]?.id ?? "";

	// Secondary fetch: full lease details (startDate, deposit) not in TenantDetailSchema.
	// Only fires when leaseId is known. Typically already warm from the leases page cache.
	const { data: leaseData } = useLease(primaryLeaseId);

	// Fetch once and scope to all active leases for this tenant. This avoids
	// dropping utility records when one tenant occupies multiple units.
	const { data: allUtilitiesData } = useUtilities();
	const utilitiesData = useMemo(() => {
		const activeLeaseIds = new Set(
			(tenant?.activeLeases ?? []).map((activeLease) => activeLease.id),
		);
		return {
			utilities: (allUtilitiesData?.utilities ?? []).filter((utility) =>
				activeLeaseIds.has(utility.leaseId),
			),
		};
	}, [allUtilitiesData?.utilities, tenant?.activeLeases]);

	// All owner payments — we filter by leaseId client-side (see computeStats + PaymentsTab)
	const { data: paymentsData } = usePayments();

	// Derived: payments for all active leases belonging to this tenant
	const leasePayments = useMemo(() => {
		const activeLeaseIds = new Set(
			(tenant?.activeLeases ?? []).map((activeLease) => activeLease.id),
		);
		return (paymentsData?.payments ?? []).filter((p) =>
			activeLeaseIds.has(p.leaseId),
		);
	}, [paymentsData?.payments, tenant?.activeLeases]);

	// Computed stats
	const stats = useMemo(
		() =>
			tenant
				? computeStats(tenant, paymentsData, utilitiesData)
				: {
						monthlyRent: 0,
						thisMonthBill: 0,
						totalPaidYTD: 0,
						overdueAmount: 0,
					},
		[tenant, paymentsData, utilitiesData],
	);

	const removeTenant = useRemoveTenant();
	const resendInvite = useResendInvite();

	// ── Loading / error states **********
	if (isLoading) return <TenantDetailSkeleton />;
	if (isError || !tenant) {
		return (
			<div className="col-span-12 flex flex-col items-center justify-center py-20 text-center">
				<p className="text-muted-foreground">
					{isError ? error.message : "Tenant not found."}
				</p>
				<Button
					variant="outline"
					className="mt-4"
					nativeButton={false}
					render={<Link href="/tenants" />}
				>
					Back to Tenants
				</Button>
			</div>
		);
	}

	//  Initials for avatar **********
	const initials = tenant.name
		.split(" ")
		.slice(0, 2)
		.map((w) => w[0] ?? "")
		.join("")
		.toUpperCase();

	//  WhatsApp link **************
	const waPhone = tenant.phone?.replace(/\D/g, "");
	const primaryActiveLease = tenant.activeLeases[0];
	const pendingInviteId = tenant.status === "pending" ? tenant.inviteId : null;

	function handleRemove() {
		removeTenant.mutate(
			{ tenantId: id },
			{ onSuccess: () => router.push("/tenants") },
		);
	}

	return (
		<div className="col-span-12 space-y-6">
			<nav className="flex items-center gap-1.5 text-sm">
				<Link href="/tenants" className="text-primary hover:underline">
					Tenants
				</Link>
				<span className="text-muted-foreground">/</span>
				<span className="text-muted-foreground">{tenant.name}</span>
			</nav>

			<div className="relative overflow-hidden rounded-xl border bg-linear-to-br from-primary/10 via-card to-card p-5 shadow-sm sm:p-7">
				<div className="absolute -top-16 -right-10 size-48 rounded-full bg-primary/[0.07] blur-2xl" />
				<div className="relative flex flex-wrap items-center gap-4">
					{/* Avatar */}
					<div className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-primary font-semibold text-lg text-primary-foreground shadow-lg shadow-primary/20">
						{initials}
					</div>

					{/* Identity */}
					<div className="min-w-0 flex-1">
						<div className="flex flex-wrap items-center gap-2">
							<h1 className="font-semibold text-2xl tracking-tight">
								{tenant.name}
							</h1>
							<span
								className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs ${tenant.status === "accepted" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"}`}
							>
								<span className="size-1.5 rounded-full bg-current" />
								{tenant.status === "accepted" ? "Active" : tenant.status}
							</span>
						</div>
						{tenant.activeLeases.length > 0 && (
							<p className="mt-0.5 text-muted-foreground text-sm">
								{tenant.activeLeases.length === 1 && primaryActiveLease
									? `${primaryActiveLease.propertyName} · Unit ${primaryActiveLease.unitNumber} · ${formatRupees(primaryActiveLease.rent)}/mo`
									: `${tenant.activeLeases.length} active units · ${formatRupees(stats.monthlyRent)}/mo`}
							</p>
						)}
					</div>

					{/* Actions */}
					<div className="ml-auto flex shrink-0 items-center gap-2">
						{pendingInviteId && (
							<Button
								variant="outline"
								size="sm"
								disabled={resendInvite.isPending}
								onClick={() =>
									resendInvite.mutate({ inviteId: pendingInviteId })
								}
							>
								<IconRefresh className="mr-1.5 size-4" />
								Resend Invitation
							</Button>
						)}
						{waPhone && (
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									window.open(`https://wa.me/${waPhone}`, "_blank")
								}
							>
								<IconBrandWhatsapp className="mr-1.5 size-4 text-emerald-600" />
								WhatsApp
							</Button>
						)}
						<Button size="sm" onClick={() => setEditOpen(true)}>
							<IconPencil className="mr-1.5 size-4" />
							Edit Tenant
						</Button>
					</div>
				</div>
			</div>

			{/* ── Stats row ********** */}
			<div className="grid grid-cols-2 overflow-hidden rounded-xl border bg-card shadow-sm sm:grid-cols-4">
				<StatCard
					label="Monthly Rent"
					value={formatRupees(stats.monthlyRent)}
					variant="primary"
				/>
				<StatCard
					label="This Month Bill"
					value={formatRupees(stats.thisMonthBill)}
				/>
				<StatCard
					label="Total Paid (YTD)"
					value={formatRupees(stats.totalPaidYTD)}
				/>
				<StatCard
					label="Overdue Amount"
					value={formatRupees(stats.overdueAmount)}
				/>
			</div>

			{/* ── Tab navigation ************* */}
			<div className="overflow-hidden rounded-xl border bg-card shadow-sm">
				<TabNav activeTab={activeTab} onTabChange={setTab} />

				<div className="p-5 sm:p-6">
					{activeTab === "overview" && (
						<OverviewTab tenant={tenant} lease={leaseData?.lease} />
					)}
					{activeTab === "utilities" && (
						<UtilitiesTab
							tenant={tenant}
							utilities={utilitiesData?.utilities ?? []}
							leaseId={primaryLeaseId}
						/>
					)}
					{activeTab === "payments" && (
						<PaymentsTab
							tenant={tenant}
							payments={leasePayments}
							stats={stats}
						/>
					)}
					{activeTab === "documents" && <DocumentsTab tenant={tenant} />}
				</div>
			</div>

			{/* ── Danger zone ************ */}
			<div className="rounded-xl border border-destructive/30 bg-card p-5">
				<div className="flex items-center justify-between">
					<div>
						<p className="font-medium text-sm">Remove Tenant</p>
						<p className="mt-0.5 text-muted-foreground text-xs">
							Terminates all active leases. The tenant's account is not deleted.
						</p>
					</div>
					<ConfirmDialog
						title="Remove Tenant"
						description={`Remove ${tenant.name}? All active leases will be terminated and units freed.`}
						confirmLabel="Remove Tenant"
						destructive
						onConfirm={handleRemove}
						isLoading={removeTenant.isPending}
						trigger={
							<Button
								variant="destructive"
								size="sm"
								disabled={removeTenant.isPending}
							>
								<IconUserMinus className="mr-1.5 size-4" />
								Remove
							</Button>
						}
					/>
				</div>
			</div>

			{/* ── Edit dialog ************ */}
			<EditTenantDialog
				open={editOpen}
				onOpenChange={setEditOpen}
				tenant={tenant}
			/>
		</div>
	);
}
