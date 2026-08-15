import { Year } from "@rently/ui/lib/date";
import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/forms/login-form";

export const metadata: Metadata = {
	title: "Sign In — KeyHQ",
};

function AuthBrand() {
	return (
		<div
			className="relative hidden flex-col justify-center overflow-hidden p-[44px_50px] lg:flex"
			style={{ background: "var(--color-primary)" }}
		>
			<div className="pointer-events-none absolute -top-32.5 -right-32.5 size-105 bg-white/7" />
			<div className="pointer-events-none absolute -bottom-22.5 -left-22.5 size-75 rounded-full bg-white/4" />

			<div className="relative z-1 flex flex-col justify-center">
				<h2 className="mb-3 font-extrabold text-[30px] text-white leading-[1.2] tracking-[-0.8px]">
					Manage your properties smarter, not harder.
				</h2>
				<p className="text-[15px] text-white/72 leading-[1.65]">
					Manage properties, leases, tenants, utilities, and payments from one
					organized workspace.
				</p>

				<div className="mt-9.5 space-y-3">
					{[
						"Manage properties, units, and leases",
						"Track rent, utilities, and payments",
						"Give tenants access through a dedicated portal",
					].map((feature) => (
						<div
							key={feature}
							className="rounded-lg bg-white/10 px-4 py-3 text-[14px] text-white/87"
						>
							{feature}
						</div>
					))}
				</div>
			</div>

			<p className="relative z-1 text-[12px] text-white/42">
				© {Year()} KeyHQ. All rights reserved.
			</p>
		</div>
	);
}

export default function LoginPage() {
	return (
		<div className="grid min-h-screen grid-cols-1 px-4 md:px-0 lg:grid-cols-[5fr_6fr]">
			<AuthBrand />

			<div className="flex items-center justify-center bg-white">
				<div className="w-full max-w-100">
					<h1 className="font-extrabold text-[27px] tracking-[-0.6px]">
						Welcome back
					</h1>
					<p className="my-1.25 mb-4 text-[14.5px] text-muted-foreground">
						Sign in to your KeyHQ account to continue
					</p>
					<Suspense fallback={null}>
						<LoginForm />
					</Suspense>
					<a
						className="mt-5 block text-center text-primary text-sm underline"
						href="/demo"
					>
						Try KeyHQ Demo
					</a>
				</div>
			</div>
		</div>
	);
}
