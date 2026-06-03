"use client";

import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@rently/ui/components/dropdown-menu";
import { IconDots, IconPencil, IconTrash } from "@tabler/icons-react";

interface EntityActionsMenuProps {
	onEdit: () => void;
	onDelete: () => void;

	editDisabled?: boolean;
	deleteDisabled?: boolean;
}

export function ActionsMenu({
	onEdit,
	onDelete,
	editDisabled = false,
	deleteDisabled = false,
}: EntityActionsMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger>
				<IconDots className="size-4 rotate-90" />
				<span className="sr-only">Open actions menu</span>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuGroup>
					<DropdownMenuItem
						className="cursor-pointer"
						disabled={editDisabled}
						onClick={onEdit}
					>
						<IconPencil className="mr-2 size-4" />
						Edit
					</DropdownMenuItem>
					<DropdownMenuSeparator />

					<DropdownMenuItem
						className="cursor-pointer text-destructive focus:text-destructive"
						disabled={deleteDisabled}
						onClick={onDelete}
					>
						<IconTrash className="mr-2 size-4" />
						Delete
					</DropdownMenuItem>
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
