"use client";
import { IconLoader2 } from "@tabler/icons-react";
import { useState } from "react";
import { Button } from "../components/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../components/dialog";
import { Separator } from "../components/separator";
import { cn } from "../lib/utils";

const sizeClasses = {
	sm: "sm:max-w-sm",
	md: "sm:max-w-md",
	lg: "sm:max-w-lg",
} as const;

interface FormDialogProps {
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	title: string;
	description?: string;
	formId: string;
	isSubmitting?: boolean;
	submitDisabled?: boolean;
	submitLabel?: string;
	size?: keyof typeof sizeClasses;
	children: React.ReactNode;
}

export function FormDialog({
	children,
	formId,
	title,
	description,
	isSubmitting = false,
	submitDisabled = false,
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	size = "md",
	submitLabel = "Save",
}: FormDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);

	const open = controlledOpen ?? internalOpen;
	const onOpenChange = controlledOnOpenChange ?? setInternalOpen;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={cn(sizeClasses[size], "rounded-lg px-0")}>
				<DialogHeader>
					<DialogTitle className="mx-4 font-bold text-xl">{title}</DialogTitle>
					{description && (
						<DialogDescription className="mx-3">
							{description}
						</DialogDescription>
					)}
					<Separator className="my-2" />
				</DialogHeader>
				<span className="mx-6">{children}</span>
				<DialogFooter className="mr-6">
					<DialogClose
						render={
							<Button
								size="lg"
								variant="outline"
								type="button"
								disabled={isSubmitting}
							/>
						}
					>
						Cancel
					</DialogClose>
					<Button
						size="lg"
						className=""
						type="submit"
						form={formId}
						disabled={isSubmitting || submitDisabled}
					>
						{isSubmitting && (
							<IconLoader2 className="mr-2 size-4 animate-spin" />
						)}
						{isSubmitting ? "Saving..." : submitLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

export function useFormDialog() {
	const [open, setOpen] = useState(false);

	return {
		open,
		onOpenChange: setOpen,
		openDialog: () => setOpen(true),
		closeDialog: () => setOpen(false),
	};
}
