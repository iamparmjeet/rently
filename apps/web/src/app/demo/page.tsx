"use client";

import { env } from "@rently/env/web";
import { Button } from "@rently/ui/components/button";
import { useState } from "react";
import { useSession } from "@/lib/auth-client";

type Persona = "owner" | "tenant";

export default function DemoPage() {
	const { data: session, isPending } = useSession();
	const [pending, setPending] = useState<Persona | null>(null);
	const [error, setError] = useState<string | null>(null);
	const realSession =
		session?.user.accountMode !== "public_demo" && !!session?.user;

	async function enter(persona: Persona) {
		setPending(persona);
		setError(null);
		try {
			const response = await fetch(
				`${env.NEXT_PUBLIC_SERVER_URL}/api/demo/session`,
				{
					method: "POST",
					credentials: "include",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ persona }),
				},
			);
			const data = (await response.json()) as {
				redirectUrl?: string;
				code?: string;
			};
			if (!response.ok || !data.redirectUrl)
				throw new Error(
					data.code === "REAL_SESSION_ACTIVE"
						? "Your signed-in KeyHQ session was kept safe. Open the demo in a private window."
						: "The demo is temporarily unavailable.",
				);
			window.location.assign(data.redirectUrl);
		} catch (reason) {
			setError(
				reason instanceof Error ? reason.message : "Unable to open the demo.",
			);
			setPending(null);
		}
	}

	return (
		<main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-5 py-16">
			<div className="max-w-2xl">
				<p className="font-medium text-primary text-sm">Try KeyHQ Demo</p>
				<h1 className="mt-2 font-bold text-4xl tracking-tight">
					Explore a real KeyHQ workspace
				</h1>
				<p className="mt-4 text-muted-foreground">
					Choose a shared owner or tenant experience. Changes are shared and
					reset every 30 minutes.
				</p>
			</div>
			{realSession ? (
				<div className="mt-8 max-w-2xl rounded-xl border bg-muted/30 p-6">
					<h2 className="font-semibold text-lg">Continue to your dashboard</h2>
					<p className="mt-2 text-muted-foreground text-sm">
						We never replace a real session. Open this demo URL in a
						private/incognito window to use either public persona.
					</p>
					<input
						className="mt-4 w-full rounded border bg-background p-2 text-sm"
						readOnly
						value={`${env.NEXT_PUBLIC_WEB_URL}/demo`}
						onFocus={(event) => event.currentTarget.select()}
						aria-label="Copyable demo URL"
					/>
				</div>
			) : (
				<div className="mt-10 grid gap-5 md:grid-cols-2">
					{(["owner", "tenant"] as const).map((persona) => (
						<section
							key={persona}
							className="rounded-xl border bg-card p-6 shadow-sm"
						>
							<h2 className="font-semibold text-xl">
								Explore{" "}
								{persona === "owner" ? "Owner Dashboard" : "Tenant Portal"}
							</h2>
							<p className="mt-2 min-h-12 text-muted-foreground text-sm">
								{persona === "owner"
									? "Manage properties, leases, rent, utilities, and notifications."
									: "Review your lease, payments, utility bills, and meter readings."}
							</p>
							<Button
								className="mt-6 w-full"
								disabled={
									pending !== null ||
									isPending ||
									env.NEXT_PUBLIC_DEMO_ENABLED !== "true"
								}
								onClick={() => enter(persona)}
							>
								{pending === persona
									? "Opening demo…"
									: `Explore ${persona === "owner" ? "owner" : "tenant"} demo`}
							</Button>
						</section>
					))}
				</div>
			)}
			{error && (
				<p role="alert" className="mt-4 text-destructive text-sm">
					{error}
				</p>
			)}
		</main>
	);
}
