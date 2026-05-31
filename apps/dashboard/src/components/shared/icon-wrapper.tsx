import { cn } from "@rently/ui/lib/utils";

export function IconWrapper({
	children,
	className,
}: {
	children: React.ReactNode;
	className: string;
}) {
	return (
		<div className={cn("rounded-md bg-primary/10 p-2", className)}>
			{children}
		</div>
	);
}
