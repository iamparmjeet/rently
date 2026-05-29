import { IconBuildingSkyscraper } from "@tabler/icons-react";
import Link from "next/link";

export default function Logo({ className }: { className?: string }) {
	return (
		<Link href="/" className={`flex items-center gap-2 ${className}`}>
			<IconBuildingSkyscraper className="h-8 w-auto shrink-0 rounded-md bg-primary p-1 text-white" />
			<span className="font-extrabold text-xl tracking-tight">RentWise</span>
		</Link>
	);
}
