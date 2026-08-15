"use client";

import { Button } from "@rently/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { ConfirmDialog } from "@rently/ui/shared/confirm-dialog";
import {
	IconBrandWhatsapp,
	IconDots,
	IconEdit,
	IconMail,
	IconTrash,
} from "@tabler/icons-react";
import { useState } from "react";

export function UtilityRowMenu({
	canEmail,
	canWhatsApp,
	isDeleting,
	onDelete,
	onEdit,
	onEmail,
	onWhatsApp,
}: {
	canEmail: boolean;
	canWhatsApp: boolean;
	isDeleting: boolean;
	onDelete: () => void;
	onEdit: () => void;
	onEmail: () => void;
	onWhatsApp: () => void;
}) {
	const [deleteOpen, setDeleteOpen] = useState(false);

	return (
		<>
			<DropdownMenu>
				<DropdownMenuTrigger
					render={
						<Button
							variant="ghost"
							size="icon"
							data-utility-row-action
							aria-label="More utility actions"
						/>
					}
				>
					<IconDots className="size-4" />
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="min-w-44 rounded-lg p-1">
					<DropdownMenuItem disabled={!canWhatsApp} onClick={onWhatsApp}>
						<IconBrandWhatsapp />
						Send via WhatsApp
					</DropdownMenuItem>
					<DropdownMenuItem disabled={!canEmail} onClick={onEmail}>
						<IconMail />
						Send via email
					</DropdownMenuItem>
					<DropdownMenuSeparator />
					<DropdownMenuItem onClick={onEdit}>
						<IconEdit />
						Edit
					</DropdownMenuItem>
					<DropdownMenuItem
						variant="destructive"
						onClick={() => setDeleteOpen(true)}
					>
						<IconTrash />
						Delete
					</DropdownMenuItem>
				</DropdownMenuContent>
			</DropdownMenu>

			<ConfirmDialog
				open={deleteOpen}
				onOpenChange={setDeleteOpen}
				title="Delete utility record?"
				description="This utility charge and its bill will be permanently deleted."
				confirmLabel="Delete"
				destructive
				isLoading={isDeleting}
				onConfirm={onDelete}
			/>
		</>
	);
}
