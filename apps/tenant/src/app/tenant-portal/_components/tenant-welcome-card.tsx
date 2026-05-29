// src/app/(tenant-portal)/tenant-portal/_components/tenant-welcome-card.tsx
"use client";

import { IconBuilding, IconHome } from "@tabler/icons-react";
import { useSession } from "@/lib/auth-client";

interface TenantWelcomeCardProps {
	// Will come from tenant lease data once API is wired
	// TODO: replace with real data from useTenantLease()
	unitNumber?: string;
	propertyName?: string;
}

export function TenantWelcomeCard({
	unitNumber,
	propertyName,
}: TenantWelcomeCardProps) {
	const { data: session } = useSession();

	const firstName = session?.user?.name?.split(" ")[0] ?? "there";

	return (
		<div className="rounded-2xl bg-linear-to-br from-primary to-primary/80 p-6 text-primary-foreground shadow-lg shadow-primary/20">
			<p className="text-primary-foreground/70 text-sm">Welcome back</p>
			<h1 className="mt-1 font-bold text-2xl">{firstName} 👋</h1>

			{/* Unit / property info — shown when lease data is available */}
			{(unitNumber ?? propertyName) && (
				<div className="mt-4 flex flex-wrap gap-3">
					{unitNumber && (
						<div className="flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-sm">
							<IconHome className="h-3.5 w-3.5" />
							Unit {unitNumber}
						</div>
					)}
					{propertyName && (
						<div className="flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-sm">
							<IconBuilding className="h-3.5 w-3.5" />
							{propertyName}
						</div>
					)}
				</div>
			)}
		</div>
	);
}
