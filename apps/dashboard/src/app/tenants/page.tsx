// server components

import { Suspense } from "react";
import TenantsClientPage from "@/components/features/tenants/tenants-client";
import { TenantsPageSkeleton } from "@/components/features/tenants/tenants-page-skelton";

export default function TenantsPage() {
	return (
		<Suspense fallback={<TenantsPageSkeleton />}>
			<TenantsClientPage />
		</Suspense>
	);
}
