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
					Join thousands of Indian landlords who save hours every week with
					KeyHQ's automated property management platform.
				</p>

				<div className="mt-9.5 flex flex-wrap gap-7.5">
					{[
						{ value: "150+", label: "Properties" },
						{ value: "2,400+", label: "Tenants" },
						{ value: "₹12Cr+", label: "Revenue" },
					].map((s) => (
						<div key={s.label}>
							<div className="font-extrabold text-[27px] text-white leading-tight">
								{s.value}
							</div>
							<div className="mt-0.5 text-[12px] text-white/62">{s.label}</div>
						</div>
					))}
				</div>

				<div className="mt-9 rounded-xl bg-white/11 p-[20px_22px]">
					<p className="text-[14px] text-white/87 italic leading-[1.62]">
						"KeyHQ completely transformed how I manage my 8 properties. I spend
						70% less time on admin work now."
					</p>
					<div className="mt-3.5 flex items-center gap-2.5">
						<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/27 font-bold text-[11px] text-white">
							RK
						</div>
						<div>
							<div className="font-semibold text-[13px] text-white">
								Rahul Kumar
							</div>
							<div className="text-[11.5px] text-white/60">
								Property owner, Bangalore
							</div>
						</div>
					</div>
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
				</div>
			</div>
		</div>
	);
}
