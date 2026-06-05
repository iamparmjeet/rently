import { Benefits } from "@/components/features/benefits";
import { CtaBand } from "@/components/features/cta-band";
import { Features } from "@/components/features/features";
import { Hero } from "@/components/features/hero";
import { HowItWorks } from "@/components/features/how-it-works";
import { Pricing } from "@/components/features/pricing";
import { TrustBar } from "@/components/features/trustbar";

export default function HomePage() {
	return (
		<div className="flex min-h-screen flex-col">
			<main className="flex-1">
				<Hero />
				<TrustBar />
				<Features />
				<HowItWorks />
				<Benefits />
				<Pricing />
				<CtaBand />
			</main>
		</div>
	);
}
