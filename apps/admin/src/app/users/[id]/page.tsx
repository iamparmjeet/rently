import { AdminUserDetail } from "@/components/features/users/admin-user-detail";

export default async function AdminUserDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { id } = await params;
	return <AdminUserDetail userId={id} />;
}
