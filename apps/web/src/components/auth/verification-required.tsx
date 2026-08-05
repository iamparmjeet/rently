"use client";

import { Button } from "@rently/ui/components/button";
import { IconLoader2, IconMailCheck } from "@tabler/icons-react";
import type { Route } from "next";
import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

type DeliveryState = "idle" | "sending" | "sent" | "error";

interface VerificationRequiredProps {
	email?: string;
	verificationCallbackUrl: string;
	safeCallbackUrl?: string;
}

export function VerificationRequired({
	verificationCallbackUrl,
	email,
	safeCallbackUrl,
}: VerificationRequiredProps) {
	const [deliveryState, setDeliveryState] = useState<DeliveryState>("idle");

	const loginHref = safeCallbackUrl
		? `/login?${new URLSearchParams({
				callbackUrl: safeCallbackUrl,
			}).toString()}`
		: "/login";

	async function resendVerificationEmail() {
		if (!email) return;
		setDeliveryState("sending");

		const { error } = await authClient.sendVerificationEmail({
			email,
			callbackURL: verificationCallbackUrl,
		});

		setDeliveryState(error ? "error" : "sent");
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-white p-6">
			<div className="w-full max-w-100 rounded-xl border border-border bg-white p-8 text-center shadow-[0_1px_4px_oklch(0_0_0/0.06)]">
				<div className="mx-auto flex size-13 items-center justify-center rounded-full bg-primary/10">
					<IconMailCheck className="size-6.5 text-primary" />
				</div>

				<h1 className="mt-5 font-extrabold text-[22px] tracking-[-0.5px]">
					Verify your email
				</h1>

				<p className="mt-2 text-[14px] text-muted-foreground leading-[1.6]">
					{email ? (
						<>
							We sent a verification link to{" "}
							<span className="font-semibold text-foreground">{email}</span>.
							Open it to continue to KeyHQ.
						</>
					) : (
						<>Check your inbox for a KeyHQ verification link.</>
					)}
				</p>

				{email && (
					<div className="mt-6">
						<Button
							type="button"
							variant="outline"
							className="w-full"
							disabled={deliveryState === "sending"}
							onClick={resendVerificationEmail}
						>
							{deliveryState === "sending" ? (
								<>
									<IconLoader2 className="size-4 animate-spin" />
									Sending…
								</>
							) : (
								"Resend verification email"
							)}
						</Button>

						{deliveryState === "sent" && (
							<p className="mt-3 text-[13px] text-muted-foreground">
								A new verification email has been sent.
							</p>
						)}

						{deliveryState === "error" && (
							<p className="mt-3 text-[13px] text-destructive">
								We could not send another email. Please try again.
							</p>
						)}
					</div>
				)}

				<Link
					href={loginHref as Route}
					className="mt-6 inline-block font-medium text-[13px] text-primary hover:underline"
				>
					Back to sign in
				</Link>
			</div>
		</div>
	);
}
