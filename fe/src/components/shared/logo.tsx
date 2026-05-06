import { IconBuilding } from "@tabler/icons-react";
import Link from "next/link";

export default function Logo({ className }: { className?: string }) {
	return (
		<Link href="/" className={`flex items-center gap-2 ${className}`}>
			<IconBuilding className="h-6 w-auto shrink-0 text-primary" />
			<span className="text-xl tracking-tight font-semibold">RentWise</span>
		</Link>
	);
}
