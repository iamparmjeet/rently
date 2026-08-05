import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/constants/support";

export const metadata: Metadata = {
	title: "Privacy Policy | KeyHQ",
	description:
		"Learn how KeyHQ collects, uses, and protects personal information.",
};

const LAST_UPDATED = "5 August 2026";

export default function PrivacyPage() {
	return (
		<main className="flex-1">
			<article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16 lg:py-20">
				<header className="border-b pb-8">
					<p className="font-medium text-primary text-sm">Legal</p>
					<h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
						Privacy Policy
					</h1>
					<p className="mt-4 text-muted-foreground text-sm">
						Last updated: <time dateTime="2026-08-05">{LAST_UPDATED}</time>
					</p>
				</header>

				<div className="space-y-10 py-8 text-base leading-7">
					<p className="text-muted-foreground">
						This Privacy Policy explains what information KeyHQ collects, why we
						use it, and the choices available to you when you use the service.
					</p>

					<section aria-labelledby="information-we-collect">
						<h2
							id="information-we-collect"
							className="font-semibold text-2xl tracking-tight"
						>
							Information we collect
						</h2>
						<div className="mt-3 space-y-4 text-muted-foreground">
							<p>
								We collect account information such as your name, email address,
								phone number, profile image, role, and authentication details.
							</p>
							<p>
								We also process information you or an authorized organization
								user adds to KeyHQ, including property and unit details, tenant
								profiles, leases, utility records, payment records, emergency
								contacts, notes, and verification information. This may include
								government identifiers such as UID/Aadhaar or PAN when
								voluntarily provided for an authorized property-management
								purpose.
							</p>
							<p>
								For security and operation, we may collect session identifiers,
								IP address, browser or device information, timestamps, and
								diagnostic logs.
							</p>
						</div>
					</section>

					<section aria-labelledby="how-we-use-information">
						<h2
							id="how-we-use-information"
							className="font-semibold text-2xl tracking-tight"
						>
							How we use information
						</h2>
						<p className="mt-3 text-muted-foreground">
							We use information to create and secure accounts, provide property
							and tenant-management features, send invitations and service
							messages, process support requests, maintain records selected by
							users, prevent fraud or abuse, troubleshoot problems, and improve
							the service.
						</p>
					</section>

					<section aria-labelledby="legal-bases">
						<h2
							id="legal-bases"
							className="font-semibold text-2xl tracking-tight"
						>
							Why we process information
						</h2>
						<p className="mt-3 text-muted-foreground">
							Depending on the context and applicable law, we process personal
							information to perform our agreement with you, follow your
							instructions, comply with legal obligations, protect legitimate
							security and business interests, or based on consent where consent
							is required.
						</p>
					</section>

					<section aria-labelledby="sharing-information">
						<h2
							id="sharing-information"
							className="font-semibold text-2xl tracking-tight"
						>
							How information is shared
						</h2>
						<p className="mt-3 text-muted-foreground">
							We may share information with authorized members of your KeyHQ
							organization, service providers that support hosting, storage,
							authentication, email, and security, and authorities when required
							by law. We do not sell personal information or use tenant
							information for third-party advertising.
						</p>
					</section>

					<section aria-labelledby="third-party-services">
						<h2
							id="third-party-services"
							className="font-semibold text-2xl tracking-tight"
						>
							Third-party services
						</h2>
						<p className="mt-3 text-muted-foreground">
							If you use social sign-in or another integrated service, the
							provider may process information under its own privacy policy.
							KeyHQ receives only the information needed to provide the selected
							integration.
						</p>
					</section>

					<section aria-labelledby="retention">
						<h2
							id="retention"
							className="font-semibold text-2xl tracking-tight"
						>
							Data retention
						</h2>
						<p className="mt-3 text-muted-foreground">
							We retain personal information while an account is active and for
							as long as reasonably necessary to provide the service, meet legal
							obligations, resolve disputes, enforce agreements, and maintain
							security. Retention periods vary according to the type of
							information and why it is held.
						</p>
					</section>

					<section aria-labelledby="security">
						<h2 id="security" className="font-semibold text-2xl tracking-tight">
							Security
						</h2>
						<p className="mt-3 text-muted-foreground">
							We use reasonable technical and organizational safeguards designed
							to protect personal information. No online service can guarantee
							complete security, so you should also protect your account
							credentials and report suspected unauthorized access promptly.
						</p>
					</section>

					<section aria-labelledby="your-rights">
						<h2
							id="your-rights"
							className="font-semibold text-2xl tracking-tight"
						>
							Your choices and rights
						</h2>
						<p className="mt-3 text-muted-foreground">
							Depending on applicable law, you may ask to access, correct,
							update, delete, or receive a copy of your personal information, or
							withdraw consent where processing relies on consent. Some records
							may be controlled by the property owner or organization that added
							them, so we may direct your request to that organization.
						</p>
					</section>

					<section aria-labelledby="children">
						<h2 id="children" className="font-semibold text-2xl tracking-tight">
							Children
						</h2>
						<p className="mt-3 text-muted-foreground">
							KeyHQ is not intended for children to use independently. Do not
							submit a child&apos;s personal information unless you have the
							legal authority and a valid property-management reason to do so.
						</p>
					</section>

					<section aria-labelledby="policy-changes">
						<h2
							id="policy-changes"
							className="font-semibold text-2xl tracking-tight"
						>
							Changes to this policy
						</h2>
						<p className="mt-3 text-muted-foreground">
							We may update this Privacy Policy as KeyHQ changes. We will post
							the updated version on this page and revise the date above.
							Material changes may also be communicated through the service or
							by email.
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
							For privacy questions or requests, email{" "}
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
