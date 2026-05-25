// server components

import { Suspense } from "react";
import TenantsClientPage from "./_components/tenants-client";
import { TenantsPageSkeleton } from "./_components/tenants-page-skelton";

export default function TenantsPage() {
	return (
		<Suspense fallback={<TenantsPageSkeleton />}>
			<TenantsClientPage />
		</Suspense>
	);
}
