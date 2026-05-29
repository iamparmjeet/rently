// src/app/(tenant-portal)/layout.tsx

import { TenantPortalHeader } from "./tenant-portal/_components/tenant-portal-header";

export default function TenantPortalLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<div className="flex min-h-screen flex-col bg-slate-50">
			<TenantPortalHeader />
			<main className="container mx-auto max-w-4xl flex-1 px-4 py-8">
				{children}
			</main>
		</div>
	);
}
