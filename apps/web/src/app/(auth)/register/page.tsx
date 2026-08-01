import { Year } from "@rently/ui/lib/date";
import type { Metadata } from "next";
import { Suspense } from "react";
import { RegisterForm } from "@/components/forms/register-form";

export const metadata: Metadata = {
	title: "Create Account — KeyHQ",
};

export default function RegisterPage() {
	return (
		<div className="grid min-h-screen grid-cols-1 lg:grid-cols-[5fr_6fr]">
			{/* Brand panel */}
			<div
				className="relative hidden flex-col justify-center overflow-hidden p-[44px_50px] lg:flex"
				style={{ background: "var(--color-primary)" }}
			>
				<div className="pointer-events-none absolute -top-32.5 -right-32.5 size-105 rounded-full bg-white/7" />
				<div className="pointer-events-none absolute -bottom-22.5 -left-22.5 size-75 rounded-full bg-white/4" />

				<div className="relative z-1">
					<h2 className="mb-3 font-extrabold text-[30px] text-white leading-[1.2] tracking-[-0.8px]">
						Start managing properties the smart way.
					</h2>
					<p className="text-[15px] text-white/72 leading-[1.65]">
						Create your free account and get set up in minutes. No credit card
						required.
					</p>
					<div className="mt-9.5 flex flex-wrap gap-7.5">
						{[
							{ value: "Free", label: "Forever plan" },
							{ value: "5 min", label: "Setup time" },
							{ value: "0", label: "Credit card required" },
						].map((s) => (
							<div key={s.label}>
								<div className="font-extrabold text-[27px] text-white leading-tight">
									{s.value}
								</div>
								<div className="mt-0.5 text-[12px] text-white/62">
									{s.label}
								</div>
							</div>
						))}
					</div>
				</div>

				<p className="relative z-1 text-[12px] text-white/42">
					© {Year()} KeyHQ. All rights reserved.
				</p>
			</div>

			{/* Form panel */}
			<div className="flex items-start justify-center overflow-y-auto bg-white px-4 py-11 lg:px-13">
				<div className="w-full max-w-100 py-0">
					<h1 className="font-extrabold text-[27px] tracking-[-0.6px]">
						Create your account
					</h1>
					<p className="mt-1.25 mb-4 text-[14.5px] text-muted-foreground">
						Start your free 14-day trial — no credit card needed
					</p>
					<Suspense fallback={null}>
						<RegisterForm />
					</Suspense>
				</div>
			</div>
		</div>
	);
}
