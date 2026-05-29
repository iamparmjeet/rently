// src/app/tenant-portal/_components/tenant-access-guard.tsx
"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import type { RedirectErrorKey } from "@/constants/redirect-errors";

interface TenantAccessGuardProps {
	// Optional — only present when middleware attached ?error=
	error?: string;
}

export function TenantAccessGuard({ error }: TenantAccessGuardProps) {
	useEffect(() => {
		if (!error) return;

		// Narrow to a known key — fall back to a generic message for unknown values
		const message =
			REDIRECT_ERRORS[error as RedirectErrorKey] ??
			"You do not have permission to access that page.";

		// Fire after a small delay — lets the page paint first so the toast is visible
		const timer = setTimeout(() => {
			toast.error(message, {
				duration: 5000,
				classNames: {
					description: "!text-muted-foreground",
				},
				// Give the user a clear next action
				description: "You have been redirected to your tenant portal.",
			});

			// Clean the URL — remove ?error= so it doesn't linger or get bookmarked
			window.history.replaceState({}, "", window.location.pathname);
		}, 100);

		return () => clearTimeout(timer);
	}, [error]);

	// Renders nothing — pure side-effect component
	return null;
}
