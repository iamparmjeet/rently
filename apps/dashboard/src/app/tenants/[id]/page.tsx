import { Suspense } from "react";
import TenantDetailClient from "@/components/features/tenants/tenant-detail-client";
import { TenantDetailSkeleton } from "@/components/features/tenants/tenant-detail-skelton";
import { Container } from "@/components/shared/container";

export default async function TenantDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;

	return (
		<Suspense fallback={<TenantDetailSkeleton />}>
			<Container>
				<TenantDetailClient id={id} />
			</Container>
		</Suspense>
	);
}
