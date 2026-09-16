import { PageLoader } from "@rently/ui/shared/page-loader";
import { Container } from "@/components/shared/container";

export default function AdminLoading() {
	return (
		<Container>
			<PageLoader rows={3} />
		</Container>
	);
}
