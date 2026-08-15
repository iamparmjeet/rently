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
import { PageHeader } from "@rently/ui/shared/page-header";
import type { AdminBetaCodeListResponse } from "@rently/validators";
import { IconPlus } from "@tabler/icons-react";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import {
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

export default function AdminBetaCodesPage() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [status, setStatus] = useState<BetaCodeFilter>("all");
	const [creating, setCreating] = useState(false);
	const [expiring, setExpiring] = useState<BetaCode | null>(null);
	const { data, isLoading } = useAdminBetaCodes({
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
						{data?.items.map((code) => (
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
									{code.usedByName ?? "—"}
									{code.usedByEmail && (
										<p className="text-muted-foreground">{code.usedByEmail}</p>
									)}
								</TableCell>
								<TableCell>{formatDate(code.expiresAt)}</TableCell>
								<TableCell>
									<StatusBadge value={code.state} />
								</TableCell>
								<TableCell className="text-right">
									<Button
										variant="outline"
										size="sm"
										disabled={code.state !== "active"}
										onClick={() => setExpiring(code)}
									>
										Expire
									</Button>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{isLoading && (
					<p className="py-8 text-center text-muted-foreground">
						Loading beta codes…
					</p>
				)}
				{!isLoading && data?.items.length === 0 && (
					<p className="py-8 text-center text-muted-foreground">
						No beta codes match these filters.
					</p>
				)}
				<Pagination
					page={page}
					totalPages={data?.totalPages ?? 0}
					onPageChange={setPage}
				/>
			</Card>

			<CreateBetaCodeDialog open={creating} onOpenChange={setCreating} />
			<ExpireBetaCodeDialog code={expiring} onClose={() => setExpiring(null)} />
		</Container>
	);
}
