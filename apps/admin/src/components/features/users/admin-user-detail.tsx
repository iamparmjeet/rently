"use client";

import { Badge } from "@rently/ui/components/badge";
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
import { Container } from "@/components/shared/container";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminUser } from "@/hooks/admin";
import { formatDate, formatMoney } from "@/utils/format";

export function AdminUserDetail({ userId }: { userId: string }) {
	const { data, isLoading } = useAdminUser(userId);
	if (isLoading) return <Container>Loading account…</Container>;
	if (!data) return <Container>Account unavailable.</Container>;

	return (
		<Container className="space-y-6">
			<PageHeader title={data.user.name} description={data.user.email} />
			<div className="grid gap-4 md:grid-cols-3">
				<Card>
					<CardHeader>
						<CardTitle>Account</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<p>
							<span className="text-muted-foreground">ID:</span>{" "}
							<span className="font-mono">{data.user.id}</span>
						</p>
						<p>
							<span className="text-muted-foreground">Role:</span>{" "}
							<Badge variant="outline" className="capitalize">
								{data.user.role}
							</Badge>
						</p>
						<p>
							<span className="text-muted-foreground">Email:</span>{" "}
							<StatusBadge
								value={data.user.emailVerified ? "verified" : "unverified"}
							/>
						</p>
						<p>
							<span className="text-muted-foreground">Joined:</span>{" "}
							{formatDate(data.user.createdAt)}
						</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Current subscription</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						<p className="font-semibold text-lg">
							{data.user.subscription?.planName ?? "No subscription"}
						</p>
						<StatusBadge
							value={
								data.user.subscription?.expired
									? "expired"
									: data.user.subscription?.status
							}
						/>
						<p className="capitalize">
							Billing: {data.user.subscription?.billingInterval ?? "—"}
						</p>
						<p>
							Starts: {formatDate(data.user.subscription?.currentPeriodStart)}
						</p>
						<p>Paid: {formatMoney(data.user.subscription?.totalPaid)}</p>
						<p>Ends: {formatDate(data.user.subscription?.currentPeriodEnd)}</p>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Portfolio summary</CardTitle>
					</CardHeader>
					<CardContent>
						{data.ownerSummary ? (
							<div className="grid grid-cols-2 gap-3">
								<Metric
									label="Properties"
									value={data.ownerSummary.propertyCount}
								/>
								<Metric label="Units" value={data.ownerSummary.unitCount} />
								<Metric label="Tenants" value={data.ownerSummary.tenantCount} />
								<Metric
									label="Active leases"
									value={data.ownerSummary.activeLeaseCount}
								/>
							</div>
						) : data.tenantSummary?.activeLease ? (
							<div className="space-y-1">
								<p>
									{data.tenantSummary.activeLease.propertyName} ·{" "}
									{data.tenantSummary.activeLease.unitNumber}
								</p>
								<p className="text-muted-foreground">
									Owner: {data.tenantSummary.activeLease.ownerName}
								</p>
								<p className="text-muted-foreground">
									{data.tenantSummary.activeLease.ownerEmail}
								</p>
								<StatusBadge value={data.tenantSummary.activeLease.status} />
							</div>
						) : (
							<p className="text-muted-foreground">
								No active portfolio or lease.
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<Card>
				<CardHeader>
					<CardTitle>Subscription invoices</CardTitle>
				</CardHeader>
				<CardContent>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Amount</TableHead>
								<TableHead>Status</TableHead>
								<TableHead>Reference</TableHead>
								<TableHead>Period</TableHead>
								<TableHead>Paid</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{data.invoices.map((invoice) => (
								<TableRow key={invoice.id}>
									<TableCell>{formatMoney(invoice.amount)}</TableCell>
									<TableCell>
										<StatusBadge value={invoice.paymentStatus} />
									</TableCell>
									<TableCell className="font-mono">
										{invoice.externalPaymentReference ?? "—"}
									</TableCell>
									<TableCell>
										{formatDate(invoice.periodStart)} –{" "}
										{formatDate(invoice.periodEnd)}
									</TableCell>
									<TableCell>{formatDate(invoice.paidAt)}</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
					{data.invoices.length === 0 && (
						<p className="py-6 text-center text-muted-foreground">
							No invoices.
						</p>
					)}
				</CardContent>
			</Card>

			<div className="grid gap-4 xl:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Subscription history</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Plan</TableHead>
									<TableHead>Status</TableHead>
									<TableHead>Interval</TableHead>
									<TableHead>Period end</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.subscriptionHistory.map((subscription) => (
									<TableRow key={subscription.id}>
										<TableCell>{subscription.planName}</TableCell>
										<TableCell>
											<StatusBadge
												value={
													subscription.expired ? "expired" : subscription.status
												}
											/>
										</TableCell>
										<TableCell className="capitalize">
											{subscription.billingInterval}
										</TableCell>
										<TableCell>
											{formatDate(subscription.currentPeriodEnd)}
										</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{data.subscriptionHistory.length === 0 && (
							<p className="py-6 text-center text-muted-foreground">
								No subscription history.
							</p>
						)}
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle>Beta-code history</CardTitle>
					</CardHeader>
					<CardContent>
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Code</TableHead>
									<TableHead>Plan</TableHead>
									<TableHead>Usage</TableHead>
									<TableHead>Used</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.betaCodes.map((code) => (
									<TableRow key={code.id}>
										<TableCell className="font-mono">{code.code}</TableCell>
										<TableCell className="capitalize">
											{code.grantsPlanSlug}
										</TableCell>
										<TableCell>
											{code.totalUses} / {code.maxUses}
										</TableCell>
										<TableCell>{formatDate(code.usedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{data.betaCodes.length === 0 && (
							<p className="py-6 text-center text-muted-foreground">
								No beta-code usage.
							</p>
						)}
					</CardContent>
				</Card>
			</div>

			<div className="grid gap-4 lg:grid-cols-2">
				<Card>
					<CardHeader>
						<CardTitle>Invitation delivery history</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{data.invites.map((invite) => (
							<div
								key={invite.id}
								className="flex items-center justify-between border-b pb-2"
							>
								<div>
									<StatusBadge value={invite.status} />{" "}
									<StatusBadge value={invite.deliveryStatus} />
									<p className="mt-1 text-muted-foreground">
										{formatDate(invite.lastSentAt ?? invite.createdAt)}
									</p>
								</div>
								<p>{invite.deliveryErrorCode ?? ""}</p>
							</div>
						))}
						{data.invites.length === 0 && (
							<p className="text-muted-foreground">No invitation history.</p>
						)}
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle>Recent operational events</CardTitle>
					</CardHeader>
					<CardContent className="space-y-3">
						{data.operationalEvents.map((event) => (
							<div key={event.id} className="border-b pb-2">
								<p className="font-medium">{event.action}</p>
								<p>{event.reason}</p>
								<p className="text-muted-foreground">
									{formatDate(event.createdAt)}
								</p>
							</div>
						))}
						{data.operationalEvents.length === 0 && (
							<p className="text-muted-foreground">
								No admin changes for this account.
							</p>
						)}
					</CardContent>
				</Card>
			</div>
		</Container>
	);
}

function Metric({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-md border p-3">
			<p className="text-muted-foreground">{label}</p>
			<p className="font-semibold text-xl">{value}</p>
		</div>
	);
}
