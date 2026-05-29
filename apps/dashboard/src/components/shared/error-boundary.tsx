// apps/web/src/components/shared/error-boundary.tsx
"use client";

// WHY "use client": React error boundaries must be class components or use the
// react-error-boundary library. Both require client-side rendering. Server
// Components cannot catch runtime errors from child components this way —
// use Next.js error.tsx for that layer.
//
// WHY we write it ourselves instead of installing react-error-boundary:
// This covers the exact use case we have (query errors in data-fetching pages)
// and avoids adding a dependency. If needs grow, swap to react-error-boundary.

import { Button } from "@rently/ui/components/button";
import { IconAlertCircle, IconRefresh } from "@tabler/icons-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
	children: ReactNode;
	// Optional custom fallback — if not provided, uses the default error card
	fallback?: ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

export class ErrorBoundary extends Component<
	ErrorBoundaryProps,
	ErrorBoundaryState
> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		// TODO: send to your observability pipeline (evlog, Sentry, etc.)
		console.error("[ErrorBoundary] caught:", error, info.componentStack);
	}

	handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	render() {
		if (this.state.hasError) {
			if (this.props.fallback) {
				return this.props.fallback;
			}

			return (
				<div className="col-span-12 flex flex-col items-center justify-center py-20 text-center">
					<div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
						<IconAlertCircle className="size-8 text-destructive/70" />
					</div>
					<h3 className="font-semibold text-lg">Something went wrong</h3>
					<p className="mt-1 max-w-sm text-muted-foreground text-sm">
						{this.state.error?.message ?? "An unexpected error occurred."}
					</p>
					<Button variant="outline" className="mt-6" onClick={this.handleReset}>
						<IconRefresh className="mr-2 size-4" />
						Try again
					</Button>
				</div>
			);
		}

		return this.props.children;
	}
}
