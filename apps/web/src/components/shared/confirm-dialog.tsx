// apps/web/src/components/shared/confirm-dialog.tsx
"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "@rently/ui/components/alert-dialog";
import { IconLoader2 } from "@tabler/icons-react";

interface ConfirmDialogProps {
	// The button/element that opens the dialog
	trigger: React.ReactNode;
	title: string;
	description: string;
	confirmLabel?: string;
	cancelLabel?: string;
	// Styles the confirm button red and changes the intent
	destructive?: boolean;
	onConfirm: () => void;
	isLoading?: boolean;
}

export function ConfirmDialog({
	trigger,
	title,
	description,
	confirmLabel = "Confirm",
	cancelLabel = "Cancel",
	destructive = false,
	onConfirm,
	isLoading = false,
}: ConfirmDialogProps) {
	return (
		<AlertDialog>
			<AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>

			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading}>
						{cancelLabel}
					</AlertDialogCancel>

					<AlertDialogAction
						onClick={onConfirm}
						disabled={isLoading}
						className={
							destructive
								? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
								: undefined
						}
					>
						{isLoading ? (
							<>
								<IconLoader2 className="mr-2 size-4 animate-spin" />
								Working...
							</>
						) : (
							confirmLabel
						)}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
