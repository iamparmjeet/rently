import {
	TenantAccessGuard,
	TenantDashboard,
} from "@/components/features/tenant";

interface PageProps {
	searchParams: Promise<{ error?: string }>;
}

export default async function TenantPortalPage({ searchParams }: PageProps) {
	const { error } = await searchParams;

	return (
		<>
			<TenantAccessGuard error={error} />
			<TenantDashboard />
		</>
	);
}
