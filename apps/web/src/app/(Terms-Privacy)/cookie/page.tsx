import type { Metadata } from "next";
import { SUPPORT_EMAIL } from "@/constants/support";

export const metadata: Metadata = {
	title: "Cookie Policy | KeyHQ",
	description: "Learn how KeyHQ uses cookies and similar technologies.",
};

const LAST_UPDATED = "5 August 2026";

export default function CookiePolicyPage() {
	return (
		<main className="flex-1">
			<article className="container mx-auto max-w-3xl px-4 py-12 sm:py-16 lg:py-20">
				<header className="border-b pb-8">
					<p className="font-medium text-primary text-sm">Legal</p>
					<h1 className="mt-2 font-semibold text-3xl tracking-tight sm:text-4xl">
						Cookie Policy
					</h1>
					<p className="mt-4 text-muted-foreground text-sm">
						Last updated: <time dateTime="2026-08-05">{LAST_UPDATED}</time>
					</p>
				</header>

				<div className="space-y-10 py-8 text-base leading-7">
					<p className="text-muted-foreground">
						KeyHQ uses cookies to keep the website secure, maintain your login
						session, and remember certain preferences.
					</p>

					<section aria-labelledby="what-are-cookies">
						<h2
							id="what-are-cookies"
							className="font-semibold text-2xl tracking-tight"
						>
							What are cookies?
						</h2>
						<p className="mt-3 text-muted-foreground">
							Cookies are small text files stored on your device when you visit
							a website. They help the website function correctly and remember
							information between visits.
						</p>
					</section>

					<section aria-labelledby="cookies-we-use">
						<h2
							id="cookies-we-use"
							className="font-semibold text-2xl tracking-tight"
						>
							Cookies we use
						</h2>

						<div className="mt-5 space-y-6">
							<div>
								<h3 className="font-semibold text-lg">Essential cookies</h3>
								<p className="mt-2 text-muted-foreground">
									These cookies are required for signing in, protecting
									accounts, maintaining secure sessions, and providing requested
									website features. The service may not work correctly without
									them.
								</p>
							</div>

							<div>
								<h3 className="font-semibold text-lg">Preference cookies</h3>
								<p className="mt-2 text-muted-foreground">
									These cookies remember choices such as interface or sidebar
									settings. They help provide a consistent experience and are
									not used for advertising.
								</p>
							</div>

							<div>
								<h3 className="font-semibold text-lg">Third-party cookies</h3>
								<p className="mt-2 text-muted-foreground">
									Trusted third-party services may set cookies when you use
									features such as social sign-in. Those cookies are governed by
									the relevant provider&apos;s privacy and cookie policies.
								</p>
							</div>
						</div>
					</section>

					<section aria-labelledby="managing-cookies">
						<h2
							id="managing-cookies"
							className="font-semibold text-2xl tracking-tight"
						>
							Managing cookies
						</h2>
						<p className="mt-3 text-muted-foreground">
							You can delete or block cookies through your browser settings.
							Blocking essential cookies may prevent you from signing in or
							using some parts of KeyHQ.
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
							We may update this Cookie Policy when our services or cookie usage
							changes. The latest version will be available on this page.
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
							For questions about this Cookie Policy, email{" "}
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
