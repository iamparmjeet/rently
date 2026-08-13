import { Badge } from "@rently/ui/components/badge";

export function StatusBadge({ value }: { value: string | null | undefined }) {
	const normalized = value ?? "unknown";
	const variant =
		normalized === "active" || normalized === "paid" || normalized === "sent"
			? "default"
			: normalized === "cancelled" ||
					normalized === "failed" ||
					normalized === "expired"
				? "destructive"
				: "outline";

	return (
		<Badge variant={variant} className="capitalize">
			{normalized.replaceAll("_", " ")}
		</Badge>
	);
}
