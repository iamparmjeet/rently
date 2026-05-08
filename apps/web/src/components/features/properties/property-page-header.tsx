import { Button } from "@rently/ui/components/button";
import { IconPlus } from "@tabler/icons-react";
import Link from "next/link";

export function PropertyPageHeader() {
	return (
		<div className="flex items-center justify-between">
			{/* Page Header */}
			<div>
				<h1 className="font-semibold text-2xl">Properties</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Manage your properties and track occupancy
				</p>
			</div>
			<Button size="lg">
				<Link href="/properties/new" className="flex items-center">
					<IconPlus className="mr-2 h-4 w-4" />
					Add Property
				</Link>
			</Button>
		</div>
	);
}
