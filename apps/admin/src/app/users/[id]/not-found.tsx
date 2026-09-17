import { IconUserOff } from "@tabler/icons-react";
import Link from "next/link";
import { Container } from "@/components/shared/container";

export default function AdminUserNotFound() {
	return (
		<Container className="flex flex-col items-center justify-center py-20 text-center">
			<IconUserOff className="size-10 text-muted-foreground" />
			<h2 className="mt-4 font-semibold text-lg">User not found</h2>
			<p className="mt-1 text-muted-foreground text-sm">
				The account may have been removed or the link is invalid.
			</p>
			<Link
				href="/users"
				className="mt-6 inline-flex h-9 items-center justify-center rounded-md border border-input bg-background px-3 font-medium text-sm shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground"
			>
				Back to users
			</Link>
		</Container>
	);
}
