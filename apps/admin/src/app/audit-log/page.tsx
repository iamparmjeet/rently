"use client";

import { Card, CardContent } from "@rently/ui/components/card";
import { Input } from "@rently/ui/components/input";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@rently/ui/components/table";
import { PageHeader } from "@rently/ui/shared/page-header";
import { useState } from "react";
import { Container } from "@/components/shared/container";
import { Pagination } from "@/components/shared/pagination";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAdminAuditLogs } from "@/hooks/admin";
import { formatDate } from "@/utils/format";

export default function AdminAuditLogPage() {
	const [page, setPage] = useState(1);
	const [action, setAction] = useState("");
	const [targetType, setTargetType] = useState("");
	const { data, isLoading } = useAdminAuditLogs({
		page,
		pageSize: 25,
		action: action.trim() || undefined,
		targetType: targetType.trim() || undefined,
	});

	return (
		<Container className="space-y-6">
			<PageHeader
				title="Audit log"
				description="Immutable reasons and safe before/after metadata for admin operations."
			/>
			<Card>
				<CardContent className="grid gap-3 sm:grid-cols-2">
					<Input
						placeholder="Filter exact action"
						value={action}
						onChange={(event) => {
							setAction(event.target.value);
							setPage(1);
						}}
					/>
					<Input
						placeholder="Filter exact target type"
						value={targetType}
						onChange={(event) => {
							setTargetType(event.target.value);
							setPage(1);
						}}
					/>
				</CardContent>
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Time</TableHead>
							<TableHead>Admin</TableHead>
							<TableHead>Action</TableHead>
							<TableHead>Target</TableHead>
							<TableHead>Reason</TableHead>
							<TableHead>Safe metadata</TableHead>
						</TableRow>
					</TableHeader>
					<TableBody>
						{data?.items.map((item) => (
							<TableRow key={item.id}>
								<TableCell className="whitespace-nowrap">
									{formatDate(item.createdAt)}
								</TableCell>
								<TableCell>
									<p className="font-medium">{item.actorAdminName}</p>
									<p className="text-muted-foreground">
										{item.actorAdminEmail}
									</p>
								</TableCell>
								<TableCell>
									<StatusBadge value={item.action} />
								</TableCell>
								<TableCell>
									<p>{item.targetType}</p>
									<p className="max-w-40 truncate font-mono text-muted-foreground">
										{item.targetId ?? "—"}
									</p>
								</TableCell>
								<TableCell className="max-w-64 whitespace-normal">
									{item.reason}
								</TableCell>
								<TableCell>
									<details className="max-w-80">
										<summary className="cursor-pointer text-primary">
											View
										</summary>
										<pre className="mt-2 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-2 text-[11px]">
											{JSON.stringify(item.metadata, null, 2)}
										</pre>
									</details>
								</TableCell>
							</TableRow>
						))}
					</TableBody>
				</Table>
				{isLoading && (
					<p className="py-8 text-center text-muted-foreground">
						Loading audit entries…
					</p>
				)}
				{!isLoading && data?.items.length === 0 && (
					<p className="py-8 text-center text-muted-foreground">
						No audit entries match these filters.
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
