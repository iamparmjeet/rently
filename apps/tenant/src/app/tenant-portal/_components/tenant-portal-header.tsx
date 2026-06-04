"use client";

import { Button } from "@rently/ui/components/button";
import Logo from "@rently/ui/shared/logo";
import { IconLogout } from "@tabler/icons-react";
import { useLogout } from "@/hooks/auth";
import { useSession } from "@/lib/auth-client";

export function TenantPortalHeader() {
	const { data: session } = useSession();
	const { handleLogout } = useLogout();

	return (
		<header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
			<div className="container mx-auto flex h-16 max-w-4xl items-center justify-between px-4">
				{/* Left: logo + portal label */}
				<div className="flex items-center gap-3">
					<Logo />
					<span className="hidden border-l pl-3 text-muted-foreground text-sm sm:block">
						Tenant Portal
					</span>
				</div>

				{/* Right: user identity + logout */}
				<div className="flex items-center gap-3">
					{session?.user && (
						<div className="hidden flex-col items-end sm:flex">
							<span className="font-medium text-sm leading-none">
								{session.user.name}
							</span>
							<span className="mt-0.5 text-muted-foreground text-xs">
								{session.user.email}
							</span>
						</div>
					)}

					{/* Avatar initial */}
					{session?.user && (
						<div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 font-semibold text-primary text-sm">
							{session.user.name?.charAt(0).toUpperCase() ?? "T"}
						</div>
					)}

					<Button
						variant="outline"
						size="sm"
						onClick={() => handleLogout}
						className="cursor-pointer gap-2"
					>
						<IconLogout className="h-4 w-4" />
						<span className="hidden sm:inline">Sign out</span>
					</Button>
				</div>
			</div>
		</header>
	);
}
