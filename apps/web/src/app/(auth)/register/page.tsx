// src/app/(auth)/register/page.tsx

import {
	Card,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";

import { IconBuilding } from "@tabler/icons-react";

import { Suspense } from "react";

import { RegisterForm } from "@/components/forms/register-form";
import { RegisterFormSkeleton } from "@/components/forms/register-form-skelton";

export default function RegisterPage() {
	return (
		<Card className="mx-auto my-12 md:max-w-5xl">
			<CardHeader className="text-center">
				<div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
					<IconBuilding className="h-6 w-6 text-primary" />
				</div>
				<CardTitle className="text-2xl">Create an account</CardTitle>
				<CardDescription>
					Start your 14-day free trial. No credit card required.
				</CardDescription>
			</CardHeader>

			<Suspense fallback={<RegisterFormSkeleton />}>
				<RegisterForm />
			</Suspense>
		</Card>
	);
}
