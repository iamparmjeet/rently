// src/app/(auth)/login/page.tsx

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";

import { IconBuilding } from "@tabler/icons-react";

import { Suspense } from "react";

import { LoginForm } from "@/components/forms/login-form";
import { LoginFormSkeleton } from "@/components/forms/login-form-skelton";

// use login has useSearchParams so it required Suspense boundary

export default function LoginPage() {
	return (
		<Card className="mx-auto my-12 md:min-w-md md:max-w-5xl">
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<IconBuilding className="h-6 w-6 text-primary" />
				</div>
				<CardTitle className="text-2xl">Welcome back</CardTitle>
				<CardDescription>
					Sign in to your RentWise account to continue
				</CardDescription>
			</CardHeader>

			<Suspense fallback={<LoginFormSkeleton />}>
				<LoginForm />
			</Suspense>
		</Card>
	);
}
