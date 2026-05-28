// apps/web/src/app/(dashboard)/utilities/page.tsx

import { Suspense } from "react";
import UtilitiesClient from "./_components/utilities-client";

function UtilitiesPageSkeleton() {
	return (
		<div className="col-span-12 flex flex-col gap-6">
			<div className="flex items-center justify-between">
				<div className="space-y-2">
					<div className="h-7 w-40 animate-pulse rounded-md bg-muted" />
					<div className="h-4 w-56 animate-pulse rounded bg-muted" />
				</div>
				<div className="h-9 w-36 animate-pulse rounded-md bg-muted" />
			</div>
			<div className="grid grid-cols-3 gap-4">
				{Array.from({ length: 3 }).map((_, i) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: skeleton
					<div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
				))}
			</div>
			<div className="h-10 w-full animate-pulse rounded-md bg-muted" />
			<div className="h-64 w-full animate-pulse rounded-xl bg-muted" />
		</div>
	);
}

export default function UtilitiesPage() {
	return (
		<Suspense fallback={<UtilitiesPageSkeleton />}>
			<UtilitiesClient />
		</Suspense>
	);
}
