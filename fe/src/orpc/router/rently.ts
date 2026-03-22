import { os } from "@orpc/server";
import { z } from "zod";

// ─── Context type ──────────────────────────────────────────────────────────────
// headers are forwarded from TanStack Start so better-auth session cookies
// are included in every BE request automatically

const base = os.$context<{ headers: Headers }>();

// ─── Properties ───────────────────────────────────────────────────────────────

const API = (headers: Headers) =>
  (path: string, init?: RequestInit) =>
    fetch(`${process.env.VITE_BE_URL ?? "http://localhost:8787"}/api/v1${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        // Forward cookies so the BE auth middleware can read the session
        cookie: headers.get("cookie") ?? "",
        ...((init?.headers as Record<string, string>) ?? {}),
      },
    });

export const propertyRouter = {
  list: base
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const res = await API(context.headers)("/rent/properties");
      if (!res.ok) throw new Error("Failed to fetch properties");
      return res.json() as Promise<Array<{
        id: string;
        name: string;
        address: string;
        type: string;
        units?: unknown[];
      }>>;
    }),

  create: base
    .input(
      z.object({
        name: z.string().min(1),
        address: z.string().min(1),
        type: z.enum(["residential", "commercial"]),
      }),
    )
    .handler(async ({ input, context }) => {
      const res = await API(context.headers)("/rent/properties", {
        method: "POST",
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to create property");
      return res.json();
    }),
};

// ─── Leases ───────────────────────────────────────────────────────────────────

export const leaseRouter = {
  list: base
    .input(z.object({}).optional())
    .handler(async ({ context }) => {
      const res = await API(context.headers)("/rent/leases");
      if (!res.ok) throw new Error("Failed to fetch leases");
      return res.json() as Promise<Array<{
        id: string;
        status: string;
        unitId: string;
        tenantId: string;
        rent: number;
        startDate: string;
      }>>;
    }),
};

// ─── Units ────────────────────────────────────────────────────────────────────

export const unitRouter = {
  listByProperty: base
    .input(z.object({ propertyId: z.string() }))
    .handler(async ({ input, context }) => {
      const res = await API(context.headers)(`/rent/properties/${input.propertyId}/units`);
      if (!res.ok) throw new Error("Failed to fetch units");
      return res.json();
    }),
};
