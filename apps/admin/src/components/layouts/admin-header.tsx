"use client";

import { env } from "@rently/env/web";
import { Button } from "@rently/ui/components/button";
import { SidebarTrigger } from "@rently/ui/components/sidebar";
import { IconLogout, IconShieldLock } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { signOut, useSession } from "@/lib/auth-client";

export function AdminHeader() {
	const { data: session } = useSession();
	const queryClient = useQueryClient();

	async function handleLogout() {
		const toastId = toast.loading("Signing out…");
		const result = await signOut();
		if (result.error) {
			toast.error(result.error.message ?? "Sign out failed", { id: toastId });
			return;
		}
		queryClient.clear();
		toast.success("Signed out", { id: toastId });
		window.location.replace(`${env.NEXT_PUBLIC_WEB_URL}/login`);
	}

	return (
		<header className="flex h-16 items-center justify-between border-b bg-background px-4 sm:px-6">
			<div className="flex items-center gap-3">
				<SidebarTrigger />
				<div className="flex items-center gap-2 text-muted-foreground text-sm">
					<IconShieldLock className="size-4 text-primary" />
					<span>Private KeyHQ administration</span>
				</div>
			</div>
			<div className="flex items-center gap-3">
				<div className="hidden text-right sm:block">
					<p className="font-medium text-sm">{session?.user.name ?? "Admin"}</p>
					<p className="text-muted-foreground text-xs">{session?.user.email}</p>
				</div>
				<Button variant="outline" onClick={handleLogout}>
					<IconLogout />
					Sign out
				</Button>
			</div>
		</header>
	);
}
