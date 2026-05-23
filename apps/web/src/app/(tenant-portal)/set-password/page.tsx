import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import { IconBuilding, IconMailOff } from "@tabler/icons-react";
import Link from "next/link";
import { SetPasswordForm } from "@/components/forms/set-password-form";

interface PageProps {
	// Next.js 15: searchParams is a Promise
	searchParams: Promise<{ token?: string }>;
}

function InvalidResetLink() {
	return (
		<div className="flex flex-col items-center gap-4 py-8 text-center">
			<div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
				<IconMailOff className="h-8 w-8 text-muted-foreground" />
			</div>
			<div>
				<h3 className="font-semibold text-lg">Invalid Reset Link</h3>
				<p className="mt-1 text-muted-foreground text-sm">
					This password reset link is missing or malformed. Please request a new
					one from your landlord.
				</p>
			</div>
			<Button variant="outline" className="mt-2">
				<Link href="/login">Go to Login</Link>
			</Button>
		</div>
	);
}

export default async function SetPasswordPage({ searchParams }: PageProps) {
	const { token } = await searchParams;

	return (
		<div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
			<div className="w-full max-w-md">
				{/* Brand mark */}
				<div className="mb-8 flex flex-col items-center gap-2">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
						<IconBuilding className="h-6 w-6 text-primary" />
					</div>
					<span className="font-semibold text-xl tracking-tight">RentWise</span>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-center text-xl">
							{token ? "Set Your Password" : "Invalid Link"}
						</CardTitle>
					</CardHeader>
					<CardContent>
						{!token ? <InvalidResetLink /> : <SetPasswordForm token={token} />}
					</CardContent>
				</Card>

				<p className="mt-6 text-center text-muted-foreground text-xs">
					Already have an account?{" "}
					<Link href="/login" className="text-primary hover:underline">
						Sign in
					</Link>
				</p>
			</div>
		</div>
	);
}
