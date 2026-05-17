// apps/web/src/app/(dashboard)/utilities/page.tsx
"use client";

import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconBolt } from "@tabler/icons-react";

export default function UtilitiesPage() {
	return (
		<div className="col-span-12 flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl">Utilities</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Track electricity, water, and maintenance readings
				</p>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconBolt className="size-5 text-muted-foreground" />
						<CardTitle className="text-base">Utility Management</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="py-16 text-center">
					<IconBolt className="mx-auto mb-4 size-16 text-muted-foreground/30" />
					<h3 className="mb-2 font-semibold text-lg">Coming Soon</h3>
					<p className="mx-auto max-w-md text-muted-foreground text-sm">
						Utility reading tracking and billing calculations will be available
						soon.
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
