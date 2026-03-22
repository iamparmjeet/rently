import {
	createFileRoute,
	Link,
	Outlet,
	redirect,
	useLocation,
	useRouter,
} from "@tanstack/react-router";
import {
	Building2,
	CreditCard,
	FileText,
	Home,
	LogOut,
	Menu,
	Users,
	X,
} from "lucide-react";
import { useState } from "react";
import { Button } from "#/components/ui/button";
import { authClient } from "#/lib/auth-client";
import { cn } from "#/lib/utils";

export const Route = createFileRoute("/_auth")({
	// Server-side redirect — runs before the page renders
	// If no session, user is sent to /login immediately, no flash
	beforeLoad: async () => {
		const session = await authClient.getSession();
		if (!session.data?.user) {
			throw redirect({ to: "/login" });
		}
		// Pass session to all child routes via context
		return { user: session.data.user };
	},
	component: AuthLayout,
});

// ─── Nav items ────────────────────────────────────────────────────────────────

const NAV = [
	{ to: "/dashboard", label: "Dashboard", icon: Home, exact: true },
	{ to: "/dashboard/properties", label: "Properties", icon: Building2 },
	{ to: "/dashboard/tenants", label: "Tenants", icon: Users },
	{ to: "/dashboard/leases", label: "Leases", icon: FileText },
	{ to: "/dashboard/payments", label: "Payments", icon: CreditCard },
] as const;

// ─── Layout ───────────────────────────────────────────────────────────────────

function AuthLayout() {
	const [sidebarOpen, setSidebarOpen] = useState(false);
	const { user } = Route.useRouteContext();

	return (
		<div className="flex h-screen overflow-hidden bg-background">
			{/* Mobile overlay */}
			{sidebarOpen && (
				<div
					className="fixed inset-0 z-20 bg-black/40 lg:hidden"
					onClick={() => setSidebarOpen(false)}
				/>
			)}

			{/* Sidebar */}
			<aside
				className={cn(
					"fixed inset-y-0 left-0 z-30 flex w-64 flex-col border-r border-border bg-card transition-transform duration-200 lg:static lg:translate-x-0",
					sidebarOpen ? "translate-x-0" : "-translate-x-full",
				)}
			>
				{/* Logo */}
				<div className="flex h-16 items-center justify-between border-b border-border px-4">
					<Link to="/" className="text-base font-semibold tracking-tight">
						Rent
						<span className="italic font-normal text-muted-foreground">
							Wise
						</span>
					</Link>
					<button
						type="button"
						className="lg:hidden text-muted-foreground hover:text-foreground"
						onClick={() => setSidebarOpen(false)}
					>
						<X className="h-4 w-4" />
					</button>
				</div>

				{/* Nav */}
				<nav className="flex-1 overflow-y-auto px-3 py-4">
					<ul className="flex flex-col gap-0.5">
						{NAV.map(({ to, label, icon: Icon }) => (
							<NavItem key={to} to={to} label={label} Icon={Icon} />
						))}
					</ul>
				</nav>

				{/* User + sign out */}
				<div className="border-t border-border p-3">
					<UserFooter user={user} />
				</div>
			</aside>

			{/* Main content */}
			<div className="flex flex-1 flex-col overflow-hidden">
				{/* Mobile header */}
				<header className="flex h-16 items-center gap-3 border-b border-border px-4 lg:hidden">
					<button
						type="button"
						onClick={() => setSidebarOpen(true)}
						className="text-muted-foreground hover:text-foreground"
					>
						<Menu className="h-5 w-5" />
					</button>
					<span className="text-sm font-semibold">RentWise</span>
				</header>

				<main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
					<Outlet />
				</main>
			</div>
		</div>
	);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function NavItem({
	to,
	label,
	Icon,
}: {
	to: string;
	label: string;
	Icon: React.ElementType;
}) {
	const location = useLocation();
	const isActive =
		location.pathname === to || location.pathname.startsWith(to + "/");

	return (
		<li>
			<Link
				to={to}
				className={cn(
					"flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
					isActive
						? "bg-accent text-accent-foreground"
						: "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
				)}
			>
				<Icon className="h-4 w-4 shrink-0" />
				{label}
			</Link>
		</li>
	);
}

function UserFooter({
	user,
}: {
	user: { name?: string | null; email: string; image?: string | null };
}) {
	const router = useRouter();

	async function handleSignOut() {
		await authClient.signOut();
		router.navigate({ to: "/login" });
	}

	return (
		<div className="flex items-center gap-2">
			{/* Avatar */}
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-medium">
				{user.name?.charAt(0).toUpperCase() ??
					user.email.charAt(0).toUpperCase()}
			</div>
			<div className="flex-1 min-w-0">
				<p className="truncate text-xs font-medium leading-none">
					{user.name ?? "Owner"}
				</p>
				<p className="truncate text-xs text-muted-foreground mt-0.5">
					{user.email}
				</p>
			</div>
			<Button
				variant="ghost"
				size="icon"
				className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
				onClick={handleSignOut}
				title="Sign out"
			>
				<LogOut className="h-3.5 w-3.5" />
			</Button>
		</div>
	);
}
