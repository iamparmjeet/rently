import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/payments/")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/api/_auth/payments/"!</div>;
}
