"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { PageHeader } from "@rently/ui/shared/page-header";
import {
	IconBuildingBank,
	IconCash,
	IconMailCheck,
	IconReceipt,
	IconUsers,
} from "@tabler/icons-react";
import { Container } from "@/components/shared/container";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminOverview } from "@/hooks/admin";
import { formatDate, formatMoney } from "@/utils/format";

export default function AdminDashboardPage() {
	const { data, isLoading } = useAdminOverview();

	const cards = [
		{
			label: "Owners",
			value: data?.users.owners ?? 0,
			detail: `${data?.users.newOwnersLast30Days ?? 0} joined in 30 days`,
			icon: IconUsers,
		},
		{
			label: "Tenants",
			value: data?.users.tenants ?? 0,
			detail: `${data?.users.newTenantsLast30Days ?? 0} joined in 30 days`,
			icon: IconBuildingBank,
		},
		{
			label: "Platform revenue",
			value: formatMoney(data?.revenue.platformRevenueLifetime),
			detail: `${formatMoney(data?.revenue.platformRevenueLast30Days)} in 30 days`,
			icon: IconCash,
		},
		{
			label: "Managed rent volume",
			value: formatMoney(data?.revenue.managedRentVolumeLifetime),
			detail: `${formatMoney(data?.revenue.managedRentVolumeLast30Days)} in 30 days; not KeyHQ revenue`,
			icon: IconReceipt,
		},
		{
			label: "Verified emails",
			value: data?.emailVerification.verified ?? 0,
			detail: `${data?.emailVerification.unverified ?? 0} accounts remain unverified`,
			icon: IconMailCheck,
		},
	];

	return (
		<Container className="space-y-6">
			<PageHeader
				title="Operations overview"
				description="Platform health, revenue, and recent operational activity."
			/>

			<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
				{cards.map((card) => (
					<Card key={card.label}>
						<CardContent className="space-y-3">
							<card.icon className="size-5 text-primary" />
							<p className="text-muted-foreground text-xs">{card.label}</p>
							<p className="font-semibold text-2xl">
								{isLoading ? "…" : card.value}
							</p>
							<p className="text-muted-foreground text-xs">{card.detail}</p>
						</CardContent>
					</Card>
				))}
			</div>
			<p className="text-muted-foreground text-xs">
				Platform revenue is the sum of paid KeyHQ subscription invoices only.
				Unpaid or failed invoices and beta-code upgrades are excluded. Managed
				rent volume is rent, utility, and deposit activity recorded by
				landlords; it is not KeyHQ revenue.
			</p>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Subscriptions</CardTitle>
					</CardHeader>
					<CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-5">
						{Object.entries(data?.subscriptions ?? {}).map(([key, value]) => (
							<div key={key} className="rounded-md border p-3">
								<p className="text-muted-foreground text-xs capitalize">
									{key}
								</p>
								<p className="mt-1 font-semibold text-xl">{value}</p>
							</div>
						))}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Plan distribution</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{data?.planDistribution.map((plan) => (
							<div
								key={plan.planId}
								className="flex items-center justify-between border-b pb-2 last:border-0"
							>
								<div>
									<p className="font-medium">{plan.planName}</p>
									<p className="text-muted-foreground text-xs">
										{plan.planSlug}
									</p>
								</div>
								<p className="font-semibold text-lg">{plan.count}</p>
							</div>
						))}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Recent registrations</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>User</TableHead>
									<TableHead>Role</TableHead>
									<TableHead>Joined</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.recentUsers.map((user) => (
									<TableRow key={user.id}>
										<TableCell>
											<p className="font-medium">{user.name}</p>
											<p className="text-muted-foreground">{user.email}</p>
										</TableCell>
										<TableCell>
											<StatusBadge value={user.role} />
										</TableCell>
										<TableCell>{formatDate(user.createdAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Recent admin actions</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Admin</TableHead>
									<TableHead>Action</TableHead>
									<TableHead>Time</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data?.recentAdminActions.map((action) => (
									<TableRow key={action.id}>
										<TableCell>
											<p className="font-medium">{action.actorAdminName}</p>
											<p className="text-muted-foreground">{action.reason}</p>
										</TableCell>
										<TableCell>
											<StatusBadge value={action.action} />
										</TableCell>
										<TableCell>{formatDate(action.createdAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Recent subscription payments</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Owner</TableHead>
								<TableHead>Amount</TableHead>
								<TableHead>Method</TableHead>
								<TableHead>Reference</TableHead>
								<TableHead>Paid</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data?.recentSubscriptionPayments.map((payment) => (
								<TableRow key={payment.invoiceId}>
									<TableCell>
										<p className="font-medium">{payment.ownerName}</p>
										<p className="text-muted-foreground">
											{payment.ownerEmail}
										</p>
									</TableCell>
									<TableCell>{formatMoney(payment.amount)}</TableCell>
									<TableCell>
										<StatusBadge value={payment.paymentMethod} />
									</TableCell>
									<TableCell className="font-mono">
										{payment.externalPaymentReference ?? "—"}
									</TableCell>
									<TableCell>{formatDate(payment.paidAt)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{!isLoading && data?.recentSubscriptionPayments.length === 0 && (
						<p className="py-8 text-center text-muted-foreground">
							No paid subscription invoices yet.
						</p>
					)}
				</CardContent>
			</Card>
		</Container>
	);
}
