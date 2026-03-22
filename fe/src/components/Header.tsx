import { Link } from "@tanstack/react-router";
import BetterAuthHeader from "#/integrations/better-auth/header-user";

export default function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md px-4">
      <nav className="page-wrap flex items-center gap-4 py-3 sm:py-4">
        {/* Logo */}
        <Link
          to="/"
          className="shrink-0 text-base font-semibold tracking-tight"
        >
          Rent<span className="italic font-normal text-muted-foreground">Wise</span>
        </Link>

        {/* Nav links */}
        <div className="hidden sm:flex items-center gap-5 ml-6">
          <NavLink to="/">Home</NavLink>
          <NavLink to="/about">About</NavLink>
        </div>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-2">
          <BetterAuthHeader />
          {/*<ThemeToggle />*/}
        </div>
      </nav>
    </header>
  );
}

function NavLink({
  to,
  children,
}: {
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="nav-link text-sm font-medium"
      activeProps={{ className: "nav-link is-active text-sm font-medium" }}
    >
      {children}
    </Link>
  );
}
