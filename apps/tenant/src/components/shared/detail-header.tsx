import { Button } from "@rently/ui/components/button";
import { IconArrowLeft } from "@tabler/icons-react";
import type { Route } from "next";
import Link, { type LinkProps } from "next/link";
import type { ReactNode } from "react";

type Href = LinkProps<Route>["href"];

interface DetailHeaderProps {
	backHref: Href;
	title: string;
	subtitle?: string;
	// Actions : Edit Button, delete button etc
	children?: ReactNode;
}

export function DetailHeader({
	backHref,
	title,
	children,
	subtitle,
}: DetailHeaderProps) {
	return (
		<div className="flex items-center justify-between gap-4">
			<div className="flex items-center gap-3">
				<Button
					variant={"ghost"}
					nativeButton={false}
					size="icon"
					render={<Link href={backHref} />}
					aria-label="Go back"
				>
					<p className="sr-only">Go Back</p>
					<IconArrowLeft className="size-4" />
				</Button>
				<div>
					<h1 className="font-semibold text-xl">{title}</h1>
					{subtitle && (
						<p className="text-muted-foreground text-sm">{subtitle}</p>
					)}
				</div>
			</div>
			{children && <div className="flex items-center gap-2">{children}</div>}
		</div>
	);
}
