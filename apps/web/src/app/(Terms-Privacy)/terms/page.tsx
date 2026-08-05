import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/constants/support";

export const metadata: Metadata = {
	title: "Terms of Service | KeyHQ",
	description: "The terms that apply when you use KeyHQ.",
};

const LAST_UPDATED = "5 August 2026";

export default function TermsPage() {
	return (
		<main className="flex-1">
			<article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16 lg:py-20">
				<header className="border-b pb-8">
					<p className="font-medium text-primary text-sm">Legal</p>
					<h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
						Terms of Service
					</h1>
					<p className="mt-4 text-muted-foreground text-sm">
						Last updated: <time dateTime="2026-08-05">{LAST_UPDATED}</time>
					</p>
				</header>

				<div className="space-y-10 py-8 text-base leading-7">
					<p className="text-muted-foreground">
						These Terms of Service govern your access to and use of KeyHQ. By
						creating an account or using the service, you agree to these terms.
					</p>

					<section aria-labelledby="using-keyhq">
						<h2
							id="using-keyhq"
							className="font-semibold text-2xl tracking-tight"
						>
							Using KeyHQ
						</h2>
						<p className="mt-3 text-muted-foreground">
							KeyHQ provides tools for managing properties, units, tenants,
							leases, utilities, payment records, documents, and related
							communications. You must use the service only for lawful purposes
							and in accordance with these terms.
						</p>
					</section>

					<section aria-labelledby="accounts">
						<h2 id="accounts" className="font-semibold text-2xl tracking-tight">
							Accounts and security
						</h2>
						<p className="mt-3 text-muted-foreground">
							You must provide accurate account information, keep your login
							details secure, and promptly notify us of suspected unauthorized
							access. You are responsible for activity performed through your
							account unless caused by a failure of KeyHQ&apos;s systems.
						</p>
					</section>

					<section aria-labelledby="your-data">
						<h2
							id="your-data"
							className="font-semibold text-2xl tracking-tight"
						>
							Your data and responsibilities
						</h2>
						<p className="mt-3 text-muted-foreground">
							You retain ownership of the information you submit. You give KeyHQ
							the limited permission needed to host, process, back up, and
							display that information to provide the service. You must have a
							lawful basis and all required permissions before adding
							information about tenants, owners, or other people.
						</p>
					</section>

					<section aria-labelledby="prohibited-use">
						<h2
							id="prohibited-use"
							className="font-semibold text-2xl tracking-tight"
						>
							Prohibited use
						</h2>
						<p className="mt-3 text-muted-foreground">
							You may not misuse the service, interfere with its security or
							operation, attempt unauthorized access, upload malicious code,
							violate another person&apos;s rights, or use KeyHQ to store or
							share unlawful, misleading, or harmful content.
						</p>
					</section>

					<section aria-labelledby="plans-and-payments">
						<h2
							id="plans-and-payments"
							className="font-semibold text-2xl tracking-tight"
						>
							Plans and payments
						</h2>
						<p className="mt-3 text-muted-foreground">
							Some features may be subject to plan limits or fees shown before
							purchase. Unless stated otherwise at checkout, fees are
							non-refundable except where required by law. KeyHQ&apos;s
							payment-tracking features are for record keeping and do not make
							KeyHQ a bank, payment processor, or party to a rental agreement.
						</p>
					</section>

					<section aria-labelledby="availability">
						<h2
							id="availability"
							className="font-semibold text-2xl tracking-tight"
						>
							Service availability
						</h2>
						<p className="mt-3 text-muted-foreground">
							We work to keep KeyHQ reliable and secure, but we do not guarantee
							that the service will always be uninterrupted or error-free.
							Features may be changed, suspended, or discontinued when
							reasonably necessary.
						</p>
					</section>

					<section aria-labelledby="termination">
						<h2
							id="termination"
							className="font-semibold text-2xl tracking-tight"
						>
							Suspension and termination
						</h2>
						<p className="mt-3 text-muted-foreground">
							You may stop using KeyHQ at any time. We may restrict or terminate
							access when an account violates these terms, creates a security or
							legal risk, or when continued operation is no longer practical.
							Where appropriate, we will provide notice and a reasonable
							opportunity to export your data.
						</p>
					</section>

					<section aria-labelledby="disclaimers">
						<h2
							id="disclaimers"
							className="font-semibold text-2xl tracking-tight"
						>
							Disclaimers and liability
						</h2>
						<p className="mt-3 text-muted-foreground">
							KeyHQ is a property-management software service and does not
							provide legal, tax, financial, or real-estate advice. To the
							extent permitted by law, KeyHQ is not liable for indirect,
							incidental, special, or consequential losses arising from your use
							of the service.
						</p>
					</section>

					<section aria-labelledby="changes">
						<h2 id="changes" className="font-semibold text-2xl tracking-tight">
							Changes to these terms
						</h2>
						<p className="mt-3 text-muted-foreground">
							We may update these terms as the service changes. We will post the
							updated version on this page and revise the date above. Material
							changes may also be communicated through the service or by email.
						</p>
					</section>

					<section aria-labelledby="contact-us">
						<h2
							id="contact-us"
							className="font-semibold text-2xl tracking-tight"
						>
							Contact us
						</h2>
						<p className="mt-3 text-muted-foreground">
							For questions about these terms, email{" "}
							<a
								href={`mailto:${SUPPORT_EMAIL}`}
								className="font-medium text-primary underline underline-offset-2"
							>
								{SUPPORT_EMAIL}
							</a>
							.
						</p>
					</section>
				</div>
			</article>
		</main>
	);
}
