import { cn } from "@rently/ui/lib/utils";

export function Container({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<main className={cn("min-h-screen px-6 py-4", className)}>{children}</main>
	);
}
