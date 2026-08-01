import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CtaBand() {
	return (
		<section className="py-23">
			<div className="mx-auto max-w-300 px-7">
				<div className="relative overflow-hidden rounded-4xl bg-primary px-15 py-17 text-center max-sm:px-7 max-sm:py-11">
					{/* Background orbs */}
					<div className="pointer-events-none absolute -top-25 -right-25 h-95 w-95 rounded-full bg-white/7" />
					<div className="pointer-events-none absolute -bottom-17.5 -left-17.5 h-65 w-65 rounded-full bg-white/4" />

					<h2 className="relative z-1 text-balance font-extrabold text-[clamp(26px,3vw,42px)] text-white leading-[1.15] tracking-[-1.1px]">
						Ready to Simplify Your Property Management?
					</h2>
					<p className="relative z-1 mx-auto mt-2.5 max-w-120 text-[16px] text-white/72">
						Join thousands of landlords who trust KeyHQ to manage their rental
						properties efficiently.
					</p>

					<div className="relative z-1 mt-7.5 flex flex-wrap justify-center gap-3">
						<Link
							href="/register"
							className="inline-flex h-13.5 items-center gap-2 rounded-lg bg-white px-9 font-semibold text-[16px] text-primary no-underline transition-all hover:bg-white/90"
						>
							Start Free Trial
							<ArrowRight className="h-4 w-4" />
						</Link>
						<Link
							href="/login"
							className="inline-flex h-13.5 items-center gap-2 rounded-lg border border-white/40 bg-transparent px-9 font-semibold text-[16px] text-white no-underline transition-all hover:bg-white/10"
						>
							Sign In
						</Link>
					</div>

					<p className="relative z-1 mt-2.5 text-[12.5px] text-white/48">
						No credit card required · 14-day free trial · Cancel anytime
					</p>
				</div>
			</div>
		</section>
	);
}
