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
	open?: boolean;
	onOpenChange?: (open: boolean) => void;
	trigger?: React.ReactElement;
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
	open,
	onOpenChange,
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
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			{trigger && <AlertDialogTrigger render={trigger} />}

			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>

				<AlertDialogFooter>
					<AlertDialogCancel disabled={isLoading} className="cursor-pointer">
						{cancelLabel}
					</AlertDialogCancel>

					<AlertDialogAction
						onClick={onConfirm}
						disabled={isLoading}
						className={
							destructive
								? "cursor-pointer bg-red-600 text-red-100 hover:bg-red-500"
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
