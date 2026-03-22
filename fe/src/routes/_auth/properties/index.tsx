import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Building2, MoreHorizontal, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { Input } from "#/components/ui/input";
import { Label } from "#/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "#/components/ui/sheet";
import { orpc } from "#/orpc/client";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_auth/properties/")({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(orpc.rent.properties.list.queryOptions()),
  component: PropertiesPage,
});

// ─── Types ────────────────────────────────────────────────────────────────────

type PropertyType = "residential" | "commercial";

interface NewPropertyForm {
  name: string;
  address: string;
  type: PropertyType;
}

const DEFAULT_FORM: NewPropertyForm = {
  name: "",
  address: "",
  type: "residential",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

function PropertiesPage() {
  const [sheetOpen, setSheetOpen] = useState(false);
  const qc = useQueryClient();

  const { data: properties } = useSuspenseQuery(
    orpc.rent.properties.list.queryOptions(),
  );

  const createProperty = useMutation(
    orpc.rent.properties.create.mutationOptions({
      onSuccess: () => {
        // Invalidate the list so it refetches
        qc.invalidateQueries(orpc.rent.properties.list.queryOptions());
        setSheetOpen(false);
      },
    }),
  );

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Properties</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {properties.length} propert{properties.length === 1 ? "y" : "ies"} total
          </p>
        </div>
        <Button onClick={() => setSheetOpen(true)} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add property
        </Button>
      </div>

      {/* List */}
      {properties.length > 0 ? (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {properties.map((property) => (
            <PropertyRow key={property.id} property={property} />
          ))}
        </div>
      ) : (
        <EmptyState onAdd={() => setSheetOpen(true)} />
      )}

      {/* Add property sheet */}
      <AddPropertySheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSubmit={(data) => createProperty.mutate(data)}
        loading={createProperty.isPending}
        error={createProperty.error?.message ?? null}
      />
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PropertyRow({ property }: { property: { id: string; name: string; address: string; type: string; units?: unknown[] } }) {
  const unitCount = property.units?.length ?? 0;

  return (
    <div className="flex items-center gap-4 px-5 py-4">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <Building2 className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{property.name}</p>
        <p className="text-xs text-muted-foreground truncate">{property.address}</p>
      </div>

      <div className="hidden sm:flex items-center gap-3">
        <Badge variant="secondary" className="capitalize text-xs">
          {property.type}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {unitCount} unit{unitCount !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="flex items-center gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link to="/dashboard/properties/$id" params={{ id: property.id }}>
            View
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem asChild>
              <Link to="/dashboard/properties/$id" params={{ id: property.id }}>
                View details
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem className="text-destructive">
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 p-16 text-center">
      <Building2 className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
      <p className="text-sm font-medium">No properties yet</p>
      <p className="text-xs text-muted-foreground mt-1 mb-5">
        Add your first property to start managing tenants and leases
      </p>
      <Button size="sm" onClick={onAdd}>
        <Plus className="mr-1.5 h-4 w-4" />
        Add your first property
      </Button>
    </div>
  );
}

function AddPropertySheet({
  open,
  onOpenChange,
  onSubmit,
  loading,
  error,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSubmit: (data: NewPropertyForm) => void;
  loading: boolean;
  error: string | null;
}) {
  const [form, setForm] = useState<NewPropertyForm>(DEFAULT_FORM);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  function set<K extends keyof NewPropertyForm>(key: K, value: NewPropertyForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add property</SheetTitle>
          <SheetDescription>
            Fill in the details for your new property.
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-6">
          {error && (
            <div className="rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-name">Property name</Label>
            <Input
              id="prop-name"
              placeholder="e.g. Sunshine Apartments"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="prop-address">Address</Label>
            <Input
              id="prop-address"
              placeholder="e.g. 12 MG Road, Ludhiana, Punjab"
              value={form.address}
              onChange={(e) => set("address", e.target.value)}
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Property type</Label>
            <div className="flex gap-2">
              {(["residential", "commercial"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => set("type", t)}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                    form.type === t
                      ? "border-foreground bg-foreground text-background"
                      : "border-border text-muted-foreground hover:border-foreground/50"
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" className="flex-1" disabled={loading}>
              {loading ? "Adding…" : "Add property"}
            </Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
