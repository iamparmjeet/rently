"use client";

import { PageHeader } from "@rently/ui/shared/page-header";
import { useEffect, useState } from "react";
import { PropertyActionButton } from "@/components/features/properties";
import { useSession } from "@/lib/auth-client";
import { formatDashboardDate } from "./dashboard-date";

export function DashboardPageHeader() {
	const { data: session } = useSession();
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => setHydrated(true), []);

	const today = formatDashboardDate(new Date());

	return (
		<PageHeader
			title={`Hi, ${hydrated ? (session?.user.name ?? "there") : "there"}`}
			description={`${today} · Here's your portfolio overview`}
		>
			<PropertyActionButton withIcon />
		</PageHeader>
	);
}
