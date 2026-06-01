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
	open: controlledOpen,
	onOpenChange: controlledOnOpenChange,
	size = "md",
	submitLabel = "Save",
}: FormDialogProps) {
	const [internalOpen, setInternalOpen] = useState(false);
	const isControlled = controlledOpen !== undefined;
	const open = isControlled ? controlledOpen : internalOpen;
	const onOpenChange = isControlled ? controlledOnOpenChange! : setInternalOpen;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className={cn(sizeClasses[size])}>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					{description && <DialogDescription>{description}</DialogDescription>}
				</DialogHeader>
				{children}
				<DialogFooter>
					<DialogClose
						render={
							<Button variant="outline" type="button" disabled={isSubmitting} />
						}
					>
						Cancel
					</DialogClose>
					<Button type="submit" form={formId} disabled={isSubmitting}>
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
		onOpenChane: setOpen,
		openDialog: () => setOpen(true),
		closeDialog: () => setOpen(false),
	};
}
