import type { Metadata } from "next";
import { Footer } from "@/ui/footer/footer";
import { Nav } from "@/ui/nav/nav";

export const metadata: Metadata = {
	title: "Privacy Policy - MeldavisStore",
	description: "Privacy Policy for MeldavisStore",
};

export default async function PrivacyPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col bg-white">
			<Nav />

			<main className="mx-auto w-full max-w-3xl p-8">
				<h1 className="text-3xl font-extrabold mb-4">Privacy Policy</h1>
				<p className="mb-4 text-muted-foreground">
					This Privacy Policy explains how MeldavisStore collects, uses, and shares information. This is a
					sample placeholder. Replace with your actual privacy policy before publishing.
				</p>
				<section className="space-y-4">
					<h2 className="text-xl font-semibold">1. Information We Collect</h2>
					<p>
						We collect information you provide and data about your interactions with the service for the
						purposes of providing and improving our products.
					</p>

					<h2 className="text-xl font-semibold">2. How We Use Information</h2>
					<p>
						We use information to process orders, communicate with you, and improve our services. We may also
						use information for analytics and fraud prevention.
					</p>

					<h2 className="text-xl font-semibold">3. Contact</h2>
					<p>
						If you have questions about privacy, contact us at <a href="/">support</a>.
					</p>
				</section>
			</main>

			<Footer />
		</div>
	);
}
