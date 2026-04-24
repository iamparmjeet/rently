import { IconBuilding } from "@tabler/icons-react";
import Link from "next/link";

export default function Logo({ className }: { className?: string }) {
	return (
		<Link href="/" className={`flex items-center gap-2 ${className}`}>
			<IconBuilding className="h-6 w-6 text-primary" />
			<span className="text-xl font-semibold">RentWise</span>
		</Link>
	);
}
