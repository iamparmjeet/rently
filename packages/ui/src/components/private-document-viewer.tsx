"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@rently/ui/components/dialog";
import { IconDownload, IconFileText } from "@tabler/icons-react";
import { Button } from "./button";

type PrivateDocumentViewerProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	contentType: string;
	url: string | null;
	loading?: boolean;
	error?: string | null;
	onDownload: () => void;
};

export function PrivateDocumentViewer({
	open,
	onOpenChange,
	title,
	contentType,
	url,
	loading = false,
	error = null,
	onDownload,
}: PrivateDocumentViewerProps) {
	const isImage = contentType === "image/jpeg" || contentType === "image/png";

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="h-[min(90vh,800px)] max-w-5xl grid-rows-[auto_1fr_auto]">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Private preview. This short-lived link is not stored.
					</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 overflow-hidden rounded-md border bg-muted/30">
					{loading && (
						<div className="flex h-full items-center justify-center text-muted-foreground">
							Loading document…
						</div>
					)}
					{error && !loading && (
						<div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-destructive">
							<IconFileText className="size-8" />
							<p>{error}</p>
						</div>
					)}
					{url && !loading && !error && isImage && (
						<div className="flex h-full items-center justify-center overflow-auto p-4">
							{/* biome-ignore lint/performance/noImgElement: signed private URLs cannot use Next image optimization. */}
							<img
								src={url}
								alt={title}
								className="max-h-full max-w-full object-contain"
							/>
						</div>
					)}
					{url && !loading && !error && contentType === "application/pdf" && (
						<iframe
							src={url}
							title={title}
							className="h-full min-h-[55vh] w-full"
						/>
					)}
				</div>
				<div className="flex justify-end">
					<Button variant="outline" onClick={onDownload} disabled={!url}>
						<IconDownload />
						Download
					</Button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
