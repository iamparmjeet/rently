"use client";

import { PAYMENT_STATUS } from "@rently/db/constants/payment-constants";
import { Badge } from "@rently/ui/components/badge";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Label } from "@rently/ui/components/label";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { Textarea } from "@rently/ui/components/textarea";
import { DetailHeader } from "@rently/ui/shared/detail-header";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { PageLoader } from "@rently/ui/shared/page-loader";
import type { AdminInvoice } from "@rently/validators";
import { IconKey } from "@tabler/icons-react";
import { notFound } from "next/navigation";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminUser, useCorrectSubscriptionPayment } from "@/hooks/admin";
import { formatDate, formatMoney } from "@/utils/format";

export function AdminUserDetail({ userId }: { userId: string }) {
	const { data, error, isPending } = useAdminUser(userId);
	const [selectedInvoice, setSelectedInvoice] = useState<AdminInvoice | null>(
		null,
	);
	if (isPending) {
		return (
			<Container>
				<PageLoader rows={3} />
			</Container>
		);
	}
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		error.code === "NOT_FOUND"
	) {
		notFound();
	}
	if (!data) return <Container>Account unavailable.</Container>;

	// The server corrects only the latest paid, non-reversed invoice, so the UI
	// offers the action on that row alone. Reversal rows are marked, and an
	// invoice that already has a reversal linked to it is marked "reversed".
	const reversedInvoiceIds = new Set(
		data.invoices
			.map((invoice) => invoice.reversesInvoiceId)
			.filter((id): id is string => id !== null),
	);
	const correctableInvoice = data.invoices
		.filter(
			(invoice) =>
				invoice.paymentStatus === PAYMENT_STATUS.PAID &&
				invoice.amount > 0 &&
				invoice.reversesInvoiceId === null,
		)
		.sort(
			(a, b) =>
				(b.paidAt ?? b.createdAt).getTime() -
				(a.paidAt ?? a.createdAt).getTime(),
		)[0];

	return (
		<Container className="space-y-6">
			<DetailHeader
				backHref="/users"
				title={data.user.name}
				subtitle={data.user.email}
			/>
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
								<TableHead>Correction</TableHead>
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
									<TableCell>
										{invoice.reversesInvoiceId ? (
											<StatusBadge value="reversal" />
										) : reversedInvoiceIds.has(invoice.id) ? (
											<StatusBadge value="reversed" />
										) : correctableInvoice?.id === invoice.id ? (
											<Button
												size="sm"
												variant="outline"
												onClick={() => setSelectedInvoice(invoice)}
											>
												Correct
											</Button>
										) : null}
									</TableCell>
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
									<TableHead>Redeemed</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{data.betaCodes.map((redemption) => (
									<TableRow key={redemption.id}>
										<TableCell className="font-mono">
											{redemption.code}
										</TableCell>
										<TableCell>{redemption.planName}</TableCell>
										<TableCell>{formatDate(redemption.redeemedAt)}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
						{data.betaCodes.length === 0 && (
							<EmptyState
								icon={IconKey}
								title="No beta-code usage"
								description="This account has not redeemed a beta code."
							/>
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

			<CorrectPaymentDialog
				ownerUserId={userId}
				invoice={selectedInvoice}
				open={Boolean(selectedInvoice)}
				onOpenChange={(open) => {
					if (!open) setSelectedInvoice(null);
				}}
			/>
		</Container>
	);
}

function CorrectPaymentDialog({
	ownerUserId,
	invoice,
	open,
	onOpenChange,
}: {
	ownerUserId: string;
	invoice: AdminInvoice | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const correctPayment = useCorrectSubscriptionPayment();
	const [reason, setReason] = useState("");

	function reset() {
		setReason("");
	}

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!invoice) return;

		correctPayment.mutate(
			{ ownerUserId, invoiceId: invoice.id, reason },
			{
				onSuccess: () => {
					reset();
					onOpenChange(false);
				},
			},
		);
	}

	return (
		<Dialog
			open={open}
			onOpenChange={(nextOpen) => {
				if (!nextOpen && !correctPayment.isPending) reset();
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Correct subscription payment</DialogTitle>
					<DialogDescription>
						This adds a linked negative invoice for{" "}
						{formatMoney(invoice?.amount)} and revokes the granted period. The
						original invoice is kept unchanged and the correction is audited.
						Only the latest paid invoice can be corrected.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={submit}>
					<div className="space-y-2">
						<Label htmlFor="correct-reason">Operational reason</Label>
						<Textarea
							id="correct-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Payment recorded against the wrong UTR"
							minLength={8}
							maxLength={500}
							required
						/>
					</div>
					<DialogFooter>
						<Button
							type="submit"
							variant="destructive"
							disabled={correctPayment.isPending || reason.trim().length < 8}
						>
							{correctPayment.isPending ? "Correcting…" : "Correct payment"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
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
