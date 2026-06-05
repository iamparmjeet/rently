"use client";

import { useState } from "react";
import { BottomNav } from "@/components/shared/bottom-nav";
import { TenantPortalHeader } from "@/components/shared/tenant-portal-header";
import { BillTab } from "./bill-tab";
import { DocsTab } from "./docs-tab";
import { OverviewTab } from "./overview-tab";
import { PaymentsTab } from "./payment-tab";
import { ReadingTab } from "./reading-tab";

export type TenantPortalTab =
	| "overview"
	| "bill"
	| "payments"
	| "reading"
	| "docs";

export function TenantDashboard() {
	const [activeTab, setActiveTab] = useState<TenantPortalTab>("overview");

	return (
		<div className="flex min-h-screen flex-col bg-muted/40">
			<TenantPortalHeader />

			<main className="mx-auto w-full max-w-170 flex-1 px-4 pt-4 pb-[84px]">
				{/* pb-[84px] = bottom nav height (60px) + gap (24px) */}
				<div className={activeTab === "overview" ? "block" : "hidden"}>
					<OverviewTab onTabChange={setActiveTab} />
				</div>
				<div className={activeTab === "bill" ? "block" : "hidden"}>
					<BillTab />
				</div>
				<div className={activeTab === "payments" ? "block" : "hidden"}>
					<PaymentsTab />
				</div>
				<div className={activeTab === "reading" ? "block" : "hidden"}>
					<ReadingTab />
				</div>
				<div className={activeTab === "docs" ? "block" : "hidden"}>
					<DocsTab />
				</div>
			</main>

			<BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
		</div>
	);
}
