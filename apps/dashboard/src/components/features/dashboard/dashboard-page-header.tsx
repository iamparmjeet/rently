"use client";

import { PageHeader } from "@rently/ui/shared/page-header";
import { PropertyActionButton } from "@/components/features/properties";
import { useSession } from "@/lib/auth-client";
import { formatDashboardDate } from "./dashboard-date";

export function DashboardPageHeader() {
	const { data: session } = useSession();
	const today = formatDashboardDate(new Date());

	return (
		<PageHeader
			title={`Hi, ${session?.user.name ?? "there"}`}
			description={`${today} · Here's your portfolio overview`}
		>
			<PropertyActionButton withIcon />
		</PageHeader>
	);
}
