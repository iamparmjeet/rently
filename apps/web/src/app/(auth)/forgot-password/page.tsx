"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { env } from "@rently/env/web";
import { Button } from "@rently/ui/components/button";
import { Input } from "@rently/ui/components/input";
import { Label } from "@rently/ui/components/label";
import Logo from "@rently/ui/shared/logo";
import { IconLoader2, IconMailCheck } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";

// ─── Schema ───
//  Inline here intentionally — no Drizzle table backs this shape.
// The three-layer validator pattern only applies to DB-derived domains.
// This is a pure frontend auth flow concern that lives nowhere else.
const forgotPasswordSchema = z.object({
	email: z.email("Enter a valid email address"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
type PagePhase = "idle" | "submitted";

const INPUT_CLS =
	"block  w-full rounded-md border border-border px-3 text-[14px] outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:shadow-[0_0_0_3px_oklch(0.488_0.243_264.376_/_0.1)] disabled:cursor-not-allowed disabled:opacity-50 aria-[invalid=true]:border-destructive";

// ─── Submitted view ──
function SubmittedView({ email }: { email: string }) {
	return (
		<div className="flex flex-col items-center gap-5 py-2 text-center">
			<div className="flex size-13 items-center justify-center rounded-full bg-primary/10">
				<IconMailCheck className="size-6.5 text-primary" />
			</div>

			<div>
				<p className="font-extrabold text-[19px] tracking-[-0.4px]">
					Check your inbox
				</p>

				<p className="mt-2 text-[14px] text-muted-foreground leading-[1.6]">
					If an account exists for{" "}
					<span className="font-semibold text-foreground">{email}</span>, a
					password reset link has been sent.
				</p>
				<p className="mt-1 text-[13px] text-muted-foreground">
					Check your spam folder if you don't see it within a minute.
				</p>
			</div>

			{/* WHY: Plain Link styled as a button — this navigates to a new page,
			    it's not a form action. Using the native <a> element (via Link)
			    is semantically correct here. No Base UI Button needed. */}
			<Link
				href="/login"
				className="mt-1 flex h-10.75 w-full items-center justify-center rounded-md border border-border font-medium text-[14px] transition-all hover:bg-muted"
			>
				Back to Sign In
			</Link>
		</div>
	);
}

// ─── Main page ───
export default function ForgotPasswordPage() {
	const [phase, setPhase] = useState<PagePhase>("idle");

	// WHY: We capture the submitted email into its own state piece BEFORE
	// the phase transitions. If we read from form state after setPhase(),
	// the form is gone from the DOM and RHF's values are inaccessible.
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
			redirectTo: `${env.NEXT_PUBLIC_WEB_URL}/set-password`,
		});

		if (error) {
			toast.error(error.message ?? "Something went wrong. Please try again.");
			return;
		}

		setSubmittedEmail(values.email);
		setPhase("submitted");
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-white p-6">
			<div className="w-full max-w-100">
				{/* ── Brand mark ────────────── */}
				<div className="mb-10 flex w-full items-center justify-center">
					<Logo />
				</div>

				<div className="rounded-xl border border-border bg-white p-[28px_32px] shadow-[0_1px_4px_oklch(0_0_0/0.06)]">
					{phase === "submitted" ? (
						<SubmittedView email={submittedEmail} />
					) : (
						<>
							<div className="mb-6">
								<h1 className="font-extrabold text-[22px] tracking-[-0.5px]">
									Forgot password?
								</h1>
								<p className="mt-1.5 text-[14px] text-muted-foreground leading-[1.6]">
									Enter your email and we'll send a reset link to your inbox.
								</p>
							</div>

							<form
								onSubmit={handleSubmit(onSubmit)}
								className="flex flex-col gap-3.5"
							>
								<div>
									<Label
										htmlFor="email"
										className="mb-1.25 block font-semibold text-[13px]"
									>
										Email address
									</Label>
									<Input
										id="email"
										type="email"
										placeholder="you@example.com"
										autoComplete="email"
										disabled={isSubmitting}
										aria-invalid={!!errors.email}
										{...register("email")}
										className={INPUT_CLS}
									/>
									{errors.email && (
										<p className="mt-1 text-[12px] text-destructive">
											{errors.email.message}
										</p>
									)}
								</div>

								<Button type="submit" disabled={isSubmitting} className="h-12">
									{isSubmitting ? (
										<>
											<IconLoader2 className="h-4 w-4 animate-spin" />
											Sending...
										</>
									) : (
										"Send Reset Link"
									)}
								</Button>
							</form>
						</>
					)}
				</div>

				{/* ── Footer ────── */}
				<p className="mt-6 text-center text-[13px] text-muted-foreground">
					Remember your password?{" "}
					<Link
						href="/login"
						className="font-medium text-primary no-underline hover:underline"
					>
						Back to Sign In
					</Link>
				</p>
			</div>
		</div>
	);
}
