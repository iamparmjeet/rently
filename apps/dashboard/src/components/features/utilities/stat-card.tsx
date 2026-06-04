export function StatCard({
	label,
	value,
	highlight = false,
}: {
	label: string;
	value: string;
	highlight?: boolean;
}) {
	return (
		<div
			className={`rounded-xl border p-4 ${highlight ? "border-destructive/30 bg-destructive/5" : "bg-white"}`}
		>
			<p className="text-muted-foreground text-sm">{label}</p>
			<p
				className={`mt-1 font-semibold text-2xl ${highlight ? "text-destructive" : ""}`}
			>
				{value}
			</p>
		</div>
	);
}
