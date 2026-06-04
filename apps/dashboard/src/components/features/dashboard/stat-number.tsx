interface StatNumberProps {
	value: number;
	isLoading: boolean;

	inverted?: boolean;
}

export function StatNumber({
	value,
	isLoading,
	inverted = false,
}: StatNumberProps) {
	if (isLoading) {
		return (
			<div
				className={`h-12 w-20 animate-pulse rounded-lg ${
					inverted ? "bg-white/20" : "bg-muted"
				}`}
			/>
		);
	}
	return (
		<p className="font-bold text-5xl tabular-nums leading-none tracking-tight">
			{value}
		</p>
	);
}
