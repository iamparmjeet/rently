// server component
// Suspense fallback

import { Suspense } from "react";
import PropertiesClient from "./_components/properties-client";
import { PropertiesPageSkeleton } from "./_components/properties-page-skelton";

export default function PropertiesPage() {
	return (
		<Suspense fallback={<PropertiesPageSkeleton />}>
			<PropertiesClient />
		</Suspense>
	);
}
