import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/leases/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/api/_auth/leases/"!</div>;
}
