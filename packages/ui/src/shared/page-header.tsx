import type { ReactNode } from "react";

interface PageHeaderProps {
	title: string;
	description?: string;
	// Action slot
	children?: ReactNode;
}

export function PageHeader({ title, children, description }: PageHeaderProps) {
	return (
		<div className="flex items-start justify-between gap-4">
			{/* min-w-0 lets the title block shrink and wrap instead of pushing the
			    action button off-screen on narrow viewports. */}
			<div className="min-w-0">
				<h1 className="font-semibold text-2xl">{title}</h1>
				{description && (
					<p className="mt-0.5 text-muted-foreground text-sm">{description}</p>
				)}
			</div>
			{children && (
				<div className="flex shrink-0 items-center gap-2">{children}</div>
			)}
		</div>
	);
}
