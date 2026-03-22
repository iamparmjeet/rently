import { useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { Building2, CreditCard, FileText, Users } from "lucide-react";
import { orpc } from "#/orpc/client";

export const Route = createFileRoute("/_auth/dashboard/")({
  // Prefetch before render — no loading spinner on navigation
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(orpc.rent.properties.list.queryOptions()),
      queryClient.ensureQueryData(orpc.rent.leases.list.queryOptions()),
    ]),
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = Route.useRouteContext();
  const { data: properties } = useSuspenseQuery(
    orpc.rent.properties.list.queryOptions(),
  );
  const { data: leases } = useSuspenseQuery(
    orpc.rent.leases.list.queryOptions(),
  );

  const activeLeases = leases?.filter((l) => l.status === "active") ?? [];
  const totalUnits = properties?.reduce(
    (sum, p) => sum + (p.units?.length ?? 0),
    0,
  ) ?? 0;

  const STATS = [
    {
      label: "Properties",
      value: properties?.length ?? 0,
      icon: Building2,
      sub: "Total owned",
    },
    {
      label: "Units",
      value: totalUnits,
      icon: Users,
      sub: "Across all properties",
    },
    {
      label: "Active leases",
      value: activeLeases.length,
      icon: FileText,
      sub: "Currently occupied",
    },
    {
      label: "Pending payments",
      value: "—",
      icon: CreditCard,
      sub: "Coming soon",
    },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Page heading */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Good morning, {user.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's what's happening with your properties today.
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {STATS.map(({ label, value, icon: Icon, sub }) => (
          <div
            key={label}
            className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-muted">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
            </div>
            <div>
              <p className="text-2xl font-semibold tracking-tight">{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Recent properties quick view */}
      {properties && properties.length > 0 && (
        <div className="flex flex-col gap-4">
          <h2 className="text-base font-semibold">Recent properties</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {properties.slice(0, 5).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between px-5 py-3"
              >
                <div>
                  <p className="text-sm font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">{p.address}</p>
                </div>
                <span className="text-xs text-muted-foreground capitalize">
                  {p.type}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {properties?.length === 0 && (
        <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
          <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
          <p className="text-sm font-medium">No properties yet</p>
          <p className="text-xs text-muted-foreground mt-1 mb-4">
            Add your first property to get started
          </p>
          <a
            href="/dashboard/properties"
            className="text-xs underline underline-offset-4 text-foreground"
          >
            Add a property
          </a>
        </div>
      )}
    </div>
  );
}
