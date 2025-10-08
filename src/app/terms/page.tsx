import type { Metadata } from "next";
import { Footer } from "@/ui/footer/footer";
import { Nav } from "@/ui/nav/nav";

export const metadata: Metadata = {
	title: "Terms of Service - MeldavisStore",
	description: "Terms of Service for MeldavisStore",
};

export default async function TermsPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col bg-white">
			{/* Header / Nav */}
			<Nav />

			<main className="mx-auto w-full max-w-3xl p-8">
				<h1 className="text-3xl font-extrabold mb-4">Terms of Service</h1>
				<p className="mb-4 text-muted-foreground">
					These Terms of Service govern your use of MeldavisStore. They are a sample placeholder. Replace with
					your actual legal text before publishing.
				</p>
				<section className="space-y-4">
					<h2 className="text-xl font-semibold">1. Acceptance of Terms</h2>
					<p>
						By using our service, you agree to these Terms. If you do not agree, please do not use the site.
					</p>

					<h2 className="text-xl font-semibold">2. Use of Service</h2>
					<p>
						You may use the service only in compliance with applicable laws and these Terms. You agree not to
						interfere with the operation of the service.
					</p>

					<h2 className="text-xl font-semibold">3. Modifications</h2>
					<p>We may update these Terms from time to time; changes take effect when posted.</p>

					<h2 className="text-xl font-semibold">Contact</h2>
					<p>
						If you have questions about these Terms, contact us at <a href="/">support</a>.
					</p>
				</section>
			</main>

			{/* Footer */}
			<Footer />
		</div>
	);
}
