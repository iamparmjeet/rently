// src/app/tenant-portal/page.tsx
import { TenantAccessGuard } from "./_components/tenant-access-guard";
import { TenantDashboard } from "./_components/tenant-dashboard";

// Next.js 15 App Router: searchParams is async — must be awaited
type TenantPortalSearchParams = Promise<{
	error?: string;
}>;

export default async function TenantPortalPage({
	searchParams,
}: {
	searchParams: TenantPortalSearchParams;
}) {
	const { error } = await searchParams;

	return (
		<>
			{/* Client component handles the toast side-effect only */}
			<TenantAccessGuard error={error} />

			{/* Main Dashboard content */}
			<TenantDashboard />
		</>
	);
}
