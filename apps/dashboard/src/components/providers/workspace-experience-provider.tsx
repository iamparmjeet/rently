"use client";

import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { client, orpc } from "@/utils/orpc";

export function WorkspaceExperienceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data } = useQuery(orpc.workspace.getExperience.queryOptions());
	const queryClient = useQueryClient();
	const [confirming, setConfirming] = useState(false);
	const [confirmation, setConfirmation] = useState("");
	const clear = useMutation({
		mutationFn: () => client.workspace.clearSample({ confirmation: "START" }),
		onSuccess: () => {
			queryClient.clear();
			window.location.replace("/dashboard");
		},
	});
	const isSample = data?.mode === "registered_sample";
	const isPublic = data?.mode === "public_demo";
	return (
		<div className="flex min-h-screen w-full flex-col bg-stone-100">
			{(isSample || isPublic) && (
				<div className="flex items-center justify-between gap-3 bg-primary px-4 py-2 text-primary-foreground text-sm">
					<span>
						{isSample
							? "Sample workspace — all domain changes are disposable."
							: `Shared demo — resets at ${data.nextPublicResetAt?.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) ?? "the next half-hour"}.`}
					</span>
					{isSample && (
						<Button
							variant="secondary"
							size="sm"
							onClick={() => setConfirming(true)}
						>
							Start with my own data
						</Button>
					)}
				</div>
			)}
			{children}
			{confirming && (
				<div
					role="dialog"
					aria-modal="true"
					className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
				>
					<div className="w-full max-w-md rounded-lg bg-background p-6 shadow-xl">
						<h2 className="font-semibold text-lg">Start with your own data</h2>
						<p className="mt-2 text-muted-foreground text-sm">
							This permanently deletes every sample property, tenant, lease,
							payment, utility, and notification. Type START to continue.
						</p>
						<Input
							className="mt-4"
							value={confirmation}
							onChange={(event) => setConfirmation(event.target.value)}
							aria-label="Type START to confirm"
						/>
						<div className="mt-5 flex justify-end gap-2">
							<Button variant="outline" onClick={() => setConfirming(false)}>
								Cancel
							</Button>
							<Button
								disabled={confirmation !== "START" || clear.isPending}
								onClick={() => clear.mutate()}
							>
								Start with my own data
							</Button>
						</div>
						{clear.error && (
							<p className="mt-2 text-destructive text-sm">
								{clear.error.message}
							</p>
						)}
					</div>
				</div>
			)}
		</div>
	);
}
