interface NotFoundStateProps {
	message?: string;
}

export function NotFoundState({
	message = "Resource not found",
}: NotFoundStateProps) {
	return (
		<div className="col-span-12 py-20 text-center text-muted-foreground">
			{message}
		</div>
	);
}
