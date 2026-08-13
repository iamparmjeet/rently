"use client";

import type { UserRole } from "@rently/db/constants/user-roles";
import { USER_ROLE_VALUES } from "@rently/db/constants/user-roles";
import { Badge } from "@rently/ui/components/badge";
import { Card, CardContent } from "@rently/ui/components/card";
import { Input } from "@rently/ui/components/input";
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
import { PageHeader } from "@rently/ui/shared/page-header";
import Link from "next/link";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminUsers, usePlans } from "@/hooks/admin";
import { formatDate } from "@/utils/format";

export default function AdminUsersPage() {
	const [page, setPage] = useState(1);
	const [search, setSearch] = useState("");
	const [role, setRole] = useState<UserRole | undefined>();
	const [verification, setVerification] = useState<"all" | "yes" | "no">("all");
	const [planSlug, setPlanSlug] = useState("");
	const [subscriptionStatus, setSubscriptionStatus] = useState<
		AdminSubscriptionStatusFilter | ""
	>("");
	const [createdFrom, setCreatedFrom] = useState("");
	const [createdTo, setCreatedTo] = useState("");
	const { data: plansData } = usePlans();
	const { data, isLoading } = useAdminUsers({
		page,
		pageSize: 25,
		search: search.trim() || undefined,
		role,
		emailVerified: verification === "all" ? undefined : verification === "yes",
		planSlug: planSlug || undefined,
		subscriptionStatus: subscriptionStatus || undefined,
		createdFrom: createdFrom
			? new Date(`${createdFrom}T00:00:00.000`)
			: undefined,
		createdTo: createdTo ? new Date(`${createdTo}T23:59:59.999`) : undefined,
	});

	return (
		<Container className="space-y-6">
			<PageHeader
				title="Users"
				description="Search accounts and inspect safe support metadata."
			/>
			<Card>
				<CardContent className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
					<Input
						type="search"
						placeholder="Search name or email"
						value={search}
						onChange={(event) => {
							setSearch(event.target.value);
							setPage(1);
						}}
						className="xl:col-span-2"
					/>
					<Select
						value={role ?? "all"}
						onValueChange={(value) => {
							setRole(value === "all" ? undefined : (value as UserRole));
							setPage(1);
						}}
					>
						<SelectTrigger>
							<SelectValue>{role ?? "All roles"}</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All roles</SelectItem>
							{USER_ROLE_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									<span className="capitalize">{value}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Select
						value={planSlug || "all"}
						onValueChange={(value) => {
							setPlanSlug(value === "all" || !value ? "" : value);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="All plans" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All plans</SelectItem>
							{plansData?.plans.map((plan) =>
								plan.slug ? (
									<SelectItem key={plan.id} value={plan.slug}>
										{plan.name}
									</SelectItem>
								) : null,
							)}
						</SelectContent>
					</Select>
					<Select
						value={subscriptionStatus || "all"}
						onValueChange={(value) => {
							setSubscriptionStatus(
								value === "all" || !value
									? ""
									: (value as AdminSubscriptionStatusFilter),
							);
							setPage(1);
						}}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Any subscription status" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Any subscription status</SelectItem>
							{ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES.map((value) => (
								<SelectItem key={value} value={value}>
									<span className="capitalize">{value}</span>
								</SelectItem>
							))}
						</SelectContent>
					</Select>
					<Input
						type="date"
						aria-label="Registered from"
						value={createdFrom}
						onChange={(event) => {
							setCreatedFrom(event.target.value);
							setPage(1);
						}}
					/>
					<Input
						type="date"
						aria-label="Registered through"
						value={createdTo}
						onChange={(event) => {
							setCreatedTo(event.target.value);
							setPage(1);
						}}
					/>
					<Select
						value={verification}
						onValueChange={(value) => {
							setVerification(value as typeof verification);
							setPage(1);
						}}
					>
						<SelectTrigger>
							<SelectValue>
								{verification === "all"
									? "Any verification"
									: verification === "yes"
										? "Verified"
										: "Unverified"}
							</SelectValue>
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">Any verification</SelectItem>
							<SelectItem value="yes">Verified</SelectItem>
							<SelectItem value="no">Unverified</SelectItem>
						</SelectContent>
					</Select>
				</CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>User</TableHead>
							<TableHead>Role</TableHead>
							<TableHead>Verification</TableHead>
							<TableHead>Plan</TableHead>
							<TableHead>Status</TableHead>
							<TableHead>Joined</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.items.map((item) => (
							<TableRow key={item.id}>
								<TableCell>
									<Link
										href={`/users/${item.id}`}
										className="font-medium text-primary hover:underline"
									>
										{item.name}
									</Link>
									<p className="text-muted-foreground">{item.email}</p>
								</TableCell>
								<TableCell>
									<Badge variant="outline" className="capitalize">
										{item.role}
									</Badge>
								</TableCell>
								<TableCell>
									<StatusBadge
										value={item.emailVerified ? "verified" : "unverified"}
									/>
								</TableCell>
								<TableCell>{item.subscription?.planName ?? "—"}</TableCell>
								<TableCell>
									<StatusBadge
										value={
											item.subscription?.expired
												? "expired"
												: item.subscription?.status
										}
									/>
								</TableCell>
								<TableCell>{formatDate(item.createdAt)}</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{isLoading && (
					<p className="py-8 text-center text-muted-foreground">
						Loading users…
					</p>
				)}
				{!isLoading && data?.items.length === 0 && (
					<p className="py-8 text-center text-muted-foreground">
						No users match these filters.
					</p>
				)}
				<Pagination
					page={page}
					totalPages={data?.totalPages ?? 0}
					onPageChange={setPage}
				/>
			</Card>
		</Container>
	);
}

import {
	ADMIN_SUBSCRIPTION_STATUS_FILTER_VALUES,
	type AdminSubscriptionStatusFilter,
} from "@rently/db/constants/admin-constants";
