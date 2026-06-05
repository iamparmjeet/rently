import { betterFetch } from "@better-fetch/fetch";
import { USER_ROLES } from "@rently/db/constants/user-roles";
import { env } from "@rently/env/web";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { isTrustedCallbackUrl } from "@/lib/trusted-url";

type SessionResponse = {
	session: { id: string; expiresAt: string };
	user: { id: string; email: string; role?: string };
};

export default async function AuthCallbackPage({
	searchParams,
}: {
	searchParams: Promise<{ callbackUrl?: string }>;
}) {
	const { callbackUrl } = await searchParams;

	const { data: session } = await betterFetch<SessionResponse>(
		"/api/auth/get-session",
		{
			baseURL: env.NEXT_PUBLIC_SERVER_URL,
			headers: {
				// WHY: forward the browser's cookies to the auth server —
				// same pattern used in proxy.ts Gate-3
				cookie: (await headers()).get("cookie") ?? "",
			},
		},
	);

	// No valid session after OAuth? Something went wrong — send to login
	if (!session?.user) {
		redirect("/login");
	}

	// callbackUrl takes priority — if they were redirected to login
	// from a specific protected page, honour that destination
	if (callbackUrl && isTrustedCallbackUrl(callbackUrl)) {
		redirect(callbackUrl as unknown as Route<string>);
	}

	const role = session.user.role;

	if (role === USER_ROLES.TENANT) {
		redirect(
			`${env.NEXT_PUBLIC_TENANT_URL}/tenant-portal` as unknown as Route<string>,
		);
	}

	redirect(
		`${env.NEXT_PUBLIC_DASHBOARD_URL}/dashboard` as unknown as Route<string>,
	);
}
