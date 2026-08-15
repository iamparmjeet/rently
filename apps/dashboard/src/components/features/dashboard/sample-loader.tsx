"use client";

import { Button } from "@rently/ui/components/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "@/utils/orpc";

export function SampleLoader({
	canLoadSample,
	isEmpty,
}: {
	canLoadSample: boolean;
	isEmpty: boolean;
}) {
	const queryClient = useQueryClient();
	const load = useMutation({
		mutationFn: () => client.workspace.loadSample(),
		onSuccess: () => queryClient.invalidateQueries(),
	});
	if (!canLoadSample || !isEmpty) return null;
	return (
		<section className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-card py-12 text-center">
			<h2 className="font-semibold text-lg">Add your first property</h2>
			<p className="mt-1 max-w-md text-muted-foreground text-sm">
				Start from scratch, or load a private disposable workspace to explore
				KeyHQ.
			</p>
			<div className="mt-4 flex gap-3">
				<Button
					variant="outline"
					onClick={() => window.location.assign("/properties")}
				>
					Add your first property
				</Button>
				<Button disabled={load.isPending} onClick={() => load.mutate()}>
					{load.isPending ? "Loading samples…" : "Load sample workspace"}
				</Button>
			</div>
			{load.error && (
				<p className="mt-3 text-destructive text-sm">{load.error.message}</p>
			)}
		</section>
	);
}
