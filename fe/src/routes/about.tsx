import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Building2,
  Code2,
  FileText,
  Globe,
  Lock,
  Users,
  Zap,
} from "lucide-react";
import { Button } from "#/components/ui/button";

export const Route = createFileRoute("/about")({
  component: AboutPage,
});

// ─── Data ────────────────────────────────────────────────────────────────────

const STACK = [
  { label: "Frontend", value: "TanStack Start + React 19" },
  { label: "Backend", value: "Hono on Node.js" },
  { label: "Database", value: "PostgreSQL + Drizzle ORM" },
  { label: "Auth", value: "better-auth" },
  { label: "API layer", value: "oRPC" },
  { label: "Styling", value: "Tailwind CSS + shadcn/ui" },
];

const VALUES = [
  {
    icon: Building2,
    title: "Built for Indian landlords",
    desc: "Designed around how property management actually works in India — monthly rent cycles, utility meter readings, and tenant referral networks.",
  },
  {
    icon: Lock,
    title: "Your data stays yours",
    desc: "No third-party analytics, no data selling, no ads. RentWise makes money through subscriptions, not your tenants' information.",
  },
  {
    icon: Zap,
    title: "Fast and reliable",
    desc: "Built on modern infrastructure. No slow dashboards, no timeouts. Your rent data is there when you need it.",
  },
  {
    icon: Globe,
    title: "Works on any device",
    desc: "Whether you're at your desk or checking rents from your phone on-site, RentWise works smoothly everywhere.",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────

function AboutPage() {
  return (
    <main className="flex flex-col">
      <Story />
      <Values />
      <Stack />
      <Builder />
      <BottomCTA />
    </main>
  );
}

// ─── Sections ────────────────────────────────────────────────────────────────

function Story() {
  return (
    <section className="px-4 py-20 border-b border-border">
      <div className="max-w-3xl mx-auto">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
          The story
        </p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl mb-6 leading-tight">
          Rent management shouldn't require{" "}
          <span className="italic font-normal text-muted-foreground">
            a degree in spreadsheets
          </span>
        </h1>
        <div className="flex flex-col gap-4 text-base text-muted-foreground leading-relaxed max-w-2xl">
          <p>
            Most landlords in India manage their properties through a combination
            of WhatsApp messages, paper receipts, and memory. When something goes
            wrong — a missed payment, an expired lease, a disputed utility bill —
            there's no trail to follow.
          </p>
          <p>
            RentWise is built to fix that. It gives property owners a single
            place to track everything: properties, units, tenants, leases,
            utility readings, and payments. Clean records, no chaos.
          </p>
          <p>
            It's not enterprise software. It's not built for real estate agencies
            with IT departments. It's built for the individual landlord who owns
            two buildings and is tired of losing receipts.
          </p>
        </div>
      </div>
    </section>
  );
}

function Values() {
  return (
    <section className="px-4 py-20 border-b border-border">
      <div className="max-w-5xl mx-auto">
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-4">
          What we believe
        </p>
        <h2 className="text-2xl font-semibold tracking-tight mb-12">
          A few things we care about
        </h2>

        <div className="grid gap-8 sm:grid-cols-2">
          {VALUES.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="flex gap-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted">
                <Icon className="h-4 w-4 text-foreground" />
              </div>
              <div className="flex flex-col gap-1">
                <h3 className="text-sm font-medium">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stack() {
  return (
    <section className="px-4 py-20 border-b border-border bg-muted/30">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          <Code2 className="h-4 w-4 text-muted-foreground" />
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            Built with
          </p>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight mb-2">
          Modern, boring technology
        </h2>
        <p className="text-sm text-muted-foreground mb-10 max-w-xl">
          Deliberately chosen for reliability and type safety — not hype.
          Every layer of the stack is strongly typed end-to-end.
        </p>

        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {STACK.map(({ label, value }) => (
            <div
              key={label}
              className="flex items-center justify-between px-5 py-3.5"
            >
              <span className="text-sm text-muted-foreground">{label}</span>
              <span className="text-sm font-medium font-mono">{value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Builder() {
  return (
    <section className="px-4 py-20 border-b border-border">
      <div className="max-w-3xl mx-auto flex flex-col sm:flex-row gap-8 items-start">
        {/* Avatar placeholder */}
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-lg font-semibold">
          P
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground mb-1">
              The builder
            </p>
            <h2 className="text-xl font-semibold">Parmjeet Mishra</h2>
            <p className="text-sm text-muted-foreground">
              Full-stack developer · Ludhiana, Punjab
            </p>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xl">
            Building RentWise as a real-world project to learn and demonstrate
            full-stack TypeScript — from Hono on the backend to TanStack Start
            on the frontend, with end-to-end type safety throughout.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <a
              href="https://parmjeetmishra.com"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-foreground underline underline-offset-4 hover:no-underline"
            >
              <Globe className="h-3.5 w-3.5" />
              parmjeetmishra.com
            </a>
            <a
              href="https://github.com/parmjeetmishra"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <GitHubIcon />
              GitHub
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function BottomCTA() {
  return (
    <section className="px-4 py-20">
      <div className="max-w-xl mx-auto text-center flex flex-col gap-6">
        <div className="flex justify-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-muted">
            <Users className="h-5 w-5 text-foreground" />
          </div>
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Try RentWise for free
        </h2>
        <p className="text-sm text-muted-foreground">
          14-day trial, no credit card required. Set up your first property
          in under 5 minutes.
        </p>
        <div className="flex flex-wrap justify-center gap-3">
          <Button size="lg" asChild>
            <Link to="/register">
              Get started free
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link to="/">See pricing</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Inline icon ──────────────────────────────────────────────────────────────

function GitHubIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      aria-hidden="true"
      fill="currentColor"
    >
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z" />
    </svg>
  );
}
