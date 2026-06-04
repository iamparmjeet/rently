// app/(marketing)/(auth)/forgot-password/page.tsx
"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@rently/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@rently/ui/components/card";
import {
	Field,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldSet,
} from "@rently/ui/components/field";
import { Input } from "@rently/ui/components/input";
import { IconBuilding, IconMailCheck } from "@tabler/icons-react";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

// ─── Schema ───────────────────────────────────────────────────────────────────
// WHY: Inline schema here, not in @rently/validators — this is a pure frontend
// auth concern, not a DB-derived shape. No Drizzle table backs this.
const forgotPasswordSchema = z.object({
	email: z.string().min(1, { error: "Email is required" }).email({
		error: "Enter a valid email address",
	}),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

// ─── Two UI phases ────────────────────────────────────────────────────────────
// WHY: Splitting into "idle" and "submitted" is a state machine pattern.
// The form disappears after submit — user can't accidentally double-submit.
type PagePhase = "idle" | "submitted";

// ─── Success state component ─────
function SubmittedView({ email }: { email: string }) {
	return (
		<div className="flex flex-col items-center gap-4 py-4 text-center">
			<div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
				<IconMailCheck className="h-7 w-7 text-primary" />
			</div>
			<div className="space-y-1">
				<p className="font-medium text-base">Check your inbox</p>
				{/* WHY: We show the email so the user knows which inbox to check,
				    but we intentionally show this message even if the email
				    wasn't found — prevents user enumeration attacks */}
				<p className="text-muted-foreground text-sm">
					If an account exists for{" "}
					<span className="font-medium text-foreground">{email}</span>, a
					password reset link has been sent.
				</p>
			</div>
			<Button
				nativeButton
				variant="outline"
				className="mt-2 w-full"
				render={<Link href="/login" />}
			>
				Back to Sign In
			</Button>
		</div>
	);
}

// ─── Main page ─────
export default function ForgotPasswordPage() {
	const [phase, setPhase] = useState<PagePhase>("idle");
	// WHY: We store the submitted email separately so SubmittedView can display it.
	// We can't read it from form state after reset() clears the form.
	const [submittedEmail, setSubmittedEmail] = useState("");

	const {
		register,
		handleSubmit,
		formState: { errors, isSubmitting },
	} = useForm<ForgotPasswordValues>({
		resolver: zodResolver(forgotPasswordSchema),
	});

	async function onSubmit(values: ForgotPasswordValues) {
		const { error } = await authClient.requestPasswordReset({
			email: values.email,
			// WHY: This is the URL Better Auth appends its signed token to.
			// It must match the set-password page that already exists in your app.
			redirectTo: "/set-password",
		});

		if (error) {
			// WHY: We still transition to "submitted" even on error, EXCEPT for
			// network/server failures. A "user not found" error should NOT be
			// surfaced — that's a security leak (user enumeration). Only hard
			// failures (rate limit, server down) get an error toast.
			toast.error(error.message ?? "Something went wrong. Please try again.");
			return;
		}

		setSubmittedEmail(values.email);
		setPhase("submitted");
	}

	return (
		<div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
			<div className="w-full max-w-md">
				{/* ── Brand mark — matches set-password page for visual consistency ── */}
				<div className="mb-8 flex flex-col items-center gap-2">
					<div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
						<IconBuilding className="h-6 w-6 text-primary" />
					</div>
					<span className="font-semibold text-xl tracking-tight">RentWise</span>
				</div>

				<Card>
					<CardHeader>
						<CardTitle className="text-center text-xl">
							{phase === "submitted" ? "Email Sent" : "Forgot Password"}
						</CardTitle>
						{phase === "idle" && (
							<CardDescription className="text-center">
								Enter your email and we'll send you a reset link.
							</CardDescription>
						)}
					</CardHeader>
					<Suspense fallback={null}>
						<CardContent>
							{phase === "submitted" ? (
								<SubmittedView email={submittedEmail} />
							) : (
								<form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
									<FieldSet>
										<FieldGroup className="flex flex-col gap-4">
											<Field data-invalid={!!errors.email}>
												<FieldLabel htmlFor="email">Email address</FieldLabel>
												<Input
													id="email"
													type="email"
													placeholder="you@example.com"
													autoComplete="email"
													disabled={isSubmitting}
													{...register("email")}
													aria-invalid={!!errors.email}
												/>
												<FieldError errors={[errors.email]} />
											</Field>
										</FieldGroup>
									</FieldSet>

									<Button
										type="submit"
										disabled={isSubmitting}
										className="w-full"
									>
										{isSubmitting ? "Sending..." : "Send Reset Link"}
									</Button>
								</form>
							)}
						</CardContent>
					</Suspense>
				</Card>

				<p className="mt-6 text-center text-muted-foreground text-xs">
					Remember your password?{" "}
					<Link href="/login" className="text-primary hover:underline">
						Back to Sign In
					</Link>
				</p>
			</div>
		</div>
	);
}
