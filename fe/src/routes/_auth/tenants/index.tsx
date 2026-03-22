import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/tenants/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/api/_auth/tenants/"!</div>;
}
