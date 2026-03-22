import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_auth/properties/$id")({
	component: RouteComponent,
});

function RouteComponent() {
	return <div>Hello "/api/_auth/properties/$id"!</div>;
}
