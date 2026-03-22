import { Link, useRouter } from "@tanstack/react-router";
import { authClient } from "#/lib/auth-client";

export default function BetterAuthHeader() {
  const { data: session, isPending } = authClient.useSession();
  const router = useRouter();

  if (isPending) {
    return (
      <div className="h-8 w-16 animate-pulse rounded-md bg-muted" />
    );
  }

  if (session?.user) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium">
          {session.user.name?.charAt(0).toUpperCase() ??
            session.user.email.charAt(0).toUpperCase()}
        </div>
        <button
          type="button"
          onClick={async () => {
            await authClient.signOut();
            router.navigate({ to: "/" });
          }}
          className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <Link
      to="/login"
      className="inline-flex h-9 items-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent"
    >
      Sign in
    </Link>
  );
}
