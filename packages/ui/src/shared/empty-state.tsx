// apps/web/src/components/shared/empty-state.tsx

import { cn } from "@rently/ui/lib/utils";
import type { ReactNode } from "react";

interface EmptyStateProps {
	// The Tabler icon component to display — e.g. IconBuilding, IconUsers
	icon: React.ElementType;
	title: string;
	description?: string;
	// Optional action slot — e.g. a "Create first property" button
	children?: ReactNode;
	className?: string;
}

// WHY a shared component: every list page (properties, units, leases, tenants)
// needs an empty state when data is [] but isLoading is false. Without a shared
// component, each page writes its own version and they drift visually.
export function EmptyState({
	icon: IconComponent,
	title,
	description,
	children,
	className,
}: EmptyStateProps) {
	return (
		<div
			className={cn(
				"col-span-12 flex flex-col items-center justify-center py-20 text-center",
				className,
			)}
		>
			<div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-muted">
				<IconComponent className="size-8 text-muted-foreground/50" />
			</div>
			<h3 className="font-semibold text-lg">{title}</h3>
			{description && (
				<p className="mt-1 max-w-sm text-muted-foreground text-sm">
					{description}
				</p>
			)}
			{children && <div className="mt-6">{children}</div>}
		</div>
	);
}
