"use client";

import {
	BETA_CODE_FILTER_VALUES,
	type BetaCodeFilter,
} from "@rently/db/constants/admin-constants";
import { Button } from "@rently/ui/components/button";
import { Card, CardContent } from "@rently/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@rently/ui/components/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { Textarea } from "@rently/ui/components/textarea";
import { EmptyState } from "@rently/ui/shared/empty-state";
import { PageHeader } from "@rently/ui/shared/page-header";
import type { AdminBetaCodeListResponse } from "@rently/validators";
import { IconKey, IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/table-skeleton";
import {
	useAdminBetaCodeRedemptions,
	useAdminBetaCodes,
	useCreateBetaCode,
	useExpireBetaCode,
	usePlans,
} from "@/hooks/admin";
import { formatDate } from "@/utils/format";

type BetaCode = AdminBetaCodeListResponse["items"][number];

function CreateBetaCodeDialog({
	open,
	onOpenChange,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { data: plansData } = usePlans();
	const createCode = useCreateBetaCode();
	const [planSlug, setPlanSlug] = useState("");
	const [periodDays, setPeriodDays] = useState("90");
	const [maxUses, setMaxUses] = useState("1");
	const [expiresAt, setExpiresAt] = useState("");
	const [reason, setReason] = useState("");

	function reset() {
		setPlanSlug("");
		setPeriodDays("90");
		setMaxUses("1");
		setExpiresAt("");
		setReason("");
	}

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		createCode.mutate(
			{
				grantsPlanSlug: planSlug,
				periodDays: Number(periodDays),
				maxUses: Number(maxUses),
				expiresAt: expiresAt ? new Date(`${expiresAt}T23:59:59`) : null,
				reason,
			},
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
				if (!nextOpen && !createCode.isPending) reset();
				onOpenChange(nextOpen);
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Create beta code</DialogTitle>
					<DialogDescription>
						The generated code grants time-limited plan access and does not
						count as platform revenue.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={submit}>
					<div className="space-y-2">
						<Label htmlFor="beta-plan">Target plan</Label>
						<Select
							value={planSlug}
							onValueChange={(value) => setPlanSlug(value ?? "")}
						>
							<SelectTrigger id="beta-plan" className="w-full">
								<SelectValue placeholder="Choose a plan" />
							</SelectTrigger>
							<SelectContent>
								{plansData?.plans.map((plan) =>
									plan.slug ? (
										<SelectItem key={plan.id} value={plan.slug}>
											{plan.name}
										</SelectItem>
									) : null,
								)}
							</SelectContent>
						</Select>
					</div>
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="space-y-2">
							<Label htmlFor="beta-period">Access period (days)</Label>
							<Input
								id="beta-period"
								type="number"
								min={1}
								max={3650}
								value={periodDays}
								onChange={(event) => setPeriodDays(event.target.value)}
								required
							/>
						</div>
						<div className="space-y-2">
							<Label htmlFor="beta-uses">Maximum uses</Label>
							<Input
								id="beta-uses"
								type="number"
								min={1}
								max={10_000}
								value={maxUses}
								onChange={(event) => setMaxUses(event.target.value)}
								required
							/>
						</div>
					</div>
					<div className="space-y-2">
						<Label htmlFor="beta-expiry">Code expiry (optional)</Label>
						<Input
							id="beta-expiry"
							type="date"
							value={expiresAt}
							onChange={(event) => setExpiresAt(event.target.value)}
						/>
					</div>
					<div className="space-y-2">
						<Label htmlFor="beta-reason">Operational reason</Label>
						<Textarea
							id="beta-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Founder-approved beta access for onboarding"
							minLength={8}
							maxLength={500}
							required
						/>
					</div>
					<DialogFooter>
						<Button
							type="submit"
							disabled={
								createCode.isPending ||
								!planSlug ||
								Number(periodDays) < 1 ||
								Number(maxUses) < 1 ||
								reason.trim().length < 8
							}
						>
							{createCode.isPending ? "Creating…" : "Create code"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function ExpireBetaCodeDialog({
	code,
	onClose,
}: {
	code: BetaCode | null;
	onClose: () => void;
}) {
	const expireCode = useExpireBetaCode();
	const [reason, setReason] = useState("");

	function submit(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!code) return;
		expireCode.mutate(
			{ betaCodeId: code.id, reason },
			{
				onSuccess: () => {
					setReason("");
					onClose();
				},
			},
		);
	}

	return (
		<Dialog
			open={Boolean(code)}
			onOpenChange={(open) => {
				if (!open && !expireCode.isPending) {
					setReason("");
					onClose();
				}
			}}
		>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Expire {code?.code}</DialogTitle>
					<DialogDescription>
						Existing redemptions remain in history. New redemptions stop
						immediately.
					</DialogDescription>
				</DialogHeader>
				<form className="space-y-4" onSubmit={submit}>
					<div className="space-y-2">
						<Label htmlFor="expire-reason">Operational reason</Label>
						<Textarea
							id="expire-reason"
							value={reason}
							onChange={(event) => setReason(event.target.value)}
							placeholder="Campaign ended earlier than planned"
							minLength={8}
							maxLength={500}
							required
						/>
					</div>
					<DialogFooter>
						<Button
							type="submit"
							variant="destructive"
							disabled={expireCode.isPending || reason.trim().length < 8}
						>
							{expireCode.isPending ? "Expiring…" : "Expire code"}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}

function RedemptionsDialog({
	code,
	onClose,
}: {
	code: BetaCode | null;
	onClose: () => void;
}) {
	const [page, setPage] = useState(1);
	const { data, isPending } = useAdminBetaCodeRedemptions(code?.id ?? "", page);

	return (
		<Dialog
			open={Boolean(code)}
			onOpenChange={(open) => {
				if (!open) {
					setPage(1);
					onClose();
				}
			}}
		>
			<DialogContent className="sm:max-w-lg">
				<DialogHeader>
					<DialogTitle>Redemptions · {code?.code}</DialogTitle>
					<DialogDescription>
						Every account that redeemed this code, newest first.
					</DialogDescription>
				</DialogHeader>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Redeemed</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{isPending ? (
							<TableSkeleton columns={2} rows={4} />
						) : data && data.items.length > 0 ? (
							data.items.map((redemption) => (
								<TableRow key={redemption.id}>
									<TableCell>
										<p className="font-medium">{redemption.userName}</p>
										<p className="text-muted-foreground">
											{redemption.userEmail}
										</p>
									</TableCell>
									<TableCell>{formatDate(redemption.redeemedAt)}</TableCell>
								</TableRow>
							))
						) : null}
					</TableBody>
				</Table>
				{!isPending && data?.items.length === 0 && (
					<p className="py-6 text-center text-muted-foreground text-sm">
						No redemptions yet.
					</p>
				)}
				<Pagination
					page={page}
					totalPages={data?.totalPages ?? 0}
					onPageChange={setPage}
				/>
			</DialogContent>
		</Dialog>
	);
}

export default function AdminBetaCodesPage() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<BetaCodeFilter>("all");
	const [creating, setCreating] = useState(false);
	const [expiring, setExpiring] = useState<BetaCode | null>(null);
	const [viewingRedemptions, setViewingRedemptions] = useState<BetaCode | null>(
		null,
	);
	const { data, isPending } = useAdminBetaCodes({
		page,
		pageSize: 25,
		search: search.trim() || undefined,
		status,
	});

	return (
		<Container className="space-y-6">
			<PageHeader
				title="Beta codes"
				description="Issue and expire promotional access without treating it as revenue."
			>
				<Button onClick={() => setCreating(true)}>
					<IconPlus /> Create code
				</Button>
			</PageHeader>
			<Card>
				<CardContent className="flex flex-col gap-3 sm:flex-row">
					<Input
						type="search"
						aria-label="Search beta codes"
						placeholder="Search code"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
						className="sm:max-w-sm"
					/>
					<Select
						value={status}
						onValueChange={(value) => {
							setStatus(value as BetaCodeFilter);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full sm:w-44">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{BETA_CODE_FILTER_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									<span className="capitalize">{value}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Code</TableHead>
							<TableHead>Plan access</TableHead>
							<TableHead>Usage</TableHead>
							<TableHead>Recipient</TableHead>
							<TableHead>Expires</TableHead>
							<TableHead>Status</TableHead>
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{isPending ? (
							<TableSkeleton columns={7} rows={8} />
						) : data && data.items.length > 0 ? (
							data.items.map((code) => (
								<TableRow key={code.id}>
									<TableCell className="font-medium font-mono">
										{code.code}
									</TableCell>
									<TableCell>
										<p className="capitalize">{code.grantsPlanSlug}</p>
										<p className="text-muted-foreground">
											{code.periodDays} days
										</p>
									</TableCell>
									<TableCell>
										{code.totalUses} / {code.maxUses}
									</TableCell>
									<TableCell>
										{code.maxUses === 1 ? (
											<>
												{code.usedByName ?? "—"}
												{code.usedByEmail && (
													<p className="text-muted-foreground">
														{code.usedByEmail}
													</p>
												)}
											</>
										) : (
											<span className="text-muted-foreground">
												{code.totalUses > 0
													? `${code.totalUses} accounts`
													: "—"}
											</span>
										)}
									</TableCell>
									<TableCell>{formatDate(code.expiresAt)}</TableCell>
									<TableCell>
										<StatusBadge value={code.state} />
									</TableCell>
									<TableCell className="text-right">
										<div className="flex justify-end gap-2">
											<Button
												variant="ghost"
												size="sm"
												disabled={code.totalUses === 0}
												onClick={() => setViewingRedemptions(code)}
											>
												View
											</Button>
											<Button
												variant="outline"
												size="sm"
												disabled={code.state !== "active"}
												onClick={() => setExpiring(code)}
											>
												Expire
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						) : null}
					</TableBody>
				</Table>
				{!isPending && data?.items.length === 0 && (
					<EmptyState
						icon={IconKey}
						title="No beta codes match"
						description="Create a code or clear the status filter to see them all."
					/>
				)}
				<Pagination
					page={page}
					totalPages={data?.totalPages ?? 0}
					onPageChange={setPage}
				/>
			</Card>

			<CreateBetaCodeDialog open={creating} onOpenChange={setCreating} />
			<ExpireBetaCodeDialog code={expiring} onClose={() => setExpiring(null)} />
			<RedemptionsDialog
				code={viewingRedemptions}
				onClose={() => setViewingRedemptions(null)}
			/>
		</Container>
	);
}
