"use client";

import { useQuery } from "@tanstack/react-query";
import { orpc } from "@/utils/orpc";

export function WorkspaceExperienceProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const { data } = useQuery(orpc.workspace.getExperience.queryOptions());
	return (
		<>
			{data?.mode === "public_demo" && (
				<div className="flex items-center justify-between bg-primary px-4 py-2 text-primary-foreground text-sm">
					<span>
						Shared demo — resets at{" "}
						{data.nextPublicResetAt?.toLocaleTimeString([], {
							hour: "2-digit",
							minute: "2-digit",
						}) ?? "the next half-hour"}
						.
					</span>
					<a className="underline" href="/">
						Exit demo
					</a>
				</div>
			)}
			{children}
		</>
	);
}
