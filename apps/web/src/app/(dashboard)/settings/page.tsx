// apps/web/src/app/(dashboard)/settings/page.tsx
"use client";

import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconBell, IconShield, IconUser } from "@tabler/icons-react";
import { useSession } from "@/lib/auth-client";

export default function SettingsPage() {
	const { data: session } = useSession();

	return (
		<div className="col-span-12 flex flex-col gap-6">
			<div>
				<h1 className="font-semibold text-2xl">Settings</h1>
				<p className="mt-0.5 text-muted-foreground text-sm">
					Manage your account and preferences
				</p>
			</div>

			{/* Current User Info */}
			<Card>
				<CardHeader>
					<div className="flex items-center gap-2">
						<IconUser className="size-5 text-muted-foreground" />
						<CardTitle className="text-base">Profile Information</CardTitle>
					</div>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="grid grid-cols-2 gap-4">
						<div>
							<p className="text-muted-foreground text-xs">Name</p>
							<p className="font-medium">{session?.user?.name || "Not set"}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Email</p>
							<p className="font-medium">{session?.user?.email}</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Role</p>
							<p className="font-medium capitalize">
								{session?.user?.role || "owner"}
							</p>
						</div>
						<div>
							<p className="text-muted-foreground text-xs">Phone</p>
							<p className="font-medium">{session?.user?.phone || "Not set"}</p>
						</div>
					</div>
					<div className="pt-4">
						<Button variant="outline" disabled>
							Edit Profile (Coming Soon)
						</Button>
					</div>
				</CardContent>
			</Card>

			{/* Feature Placeholders */}
			<div className="grid gap-4 sm:grid-cols-2">
				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<IconBell className="size-5 text-muted-foreground" />
							<CardTitle className="text-base">Notifications</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<CardDescription className="mb-3">
							Configure email alerts for rent due dates and new tenant signups.
						</CardDescription>
						<Button variant="outline" size="sm" disabled>
							Configure (Coming Soon)
						</Button>
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<div className="flex items-center gap-2">
							<IconShield className="size-5 text-muted-foreground" />
							<CardTitle className="text-base">Security</CardTitle>
						</div>
					</CardHeader>
					<CardContent>
						<CardDescription className="mb-3">
							Manage your password and active login sessions.
						</CardDescription>
						<Button variant="outline" size="sm" disabled>
							Manage (Coming Soon)
						</Button>
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
