import { Suspense } from "react";
import { SettingsClient } from "@/components/features/settings";
import { Container } from "@/components/shared/container";

export default function SettingsPage() {
	return (
		<Suspense fallback={null}>
			<Container>
				<SettingsClient />
			</Container>
		</Suspense>
	);
}
