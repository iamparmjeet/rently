import { cn } from "@rently/ui/lib/utils";

export function Container({
	className,
	...props
}: React.ComponentProps<"main">) {
	return (
		<main
			className={cn("mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6", className)}
			{...props}
		/>
	);
}
