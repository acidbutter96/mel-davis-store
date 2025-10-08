import type { Metadata } from "next";
import { Footer } from "@/ui/footer/footer";
import { Nav } from "@/ui/nav/nav";

export const metadata: Metadata = {
	title: "FAQ - Mel Davis Store",
	description: "Frequently Asked Questions about shopping, shipping, and policies.",
};

const faqs: { q: string; a: string }[] = [
	{
		q: "What payment methods do you accept?",
		a: "We accept major credit cards, Stripe, Apple Pay, Google Pay, and more listed in the footer.",
	},
	{
		q: "How can I track my order?",
		a: "Once your order ships you'll receive a confirmation email with a tracking link.",
	},
	{
		q: "Can I return an item?",
		a: "Yes, items in original condition can be returned within 30 days. More details will be in a future Returns page.",
	},
	{
		q: "Do you offer international shipping?",
		a: "International shipping availability depends on the destination and will expand over time.",
	},
];

export default function FaqPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col bg-white">
			<Nav />
			<main className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
				<h1 className="text-2xl font-semibold tracking-tight mb-6">Frequently Asked Questions</h1>
				<div className="space-y-6">
					{faqs.map(({ q, a }) => (
						<div key={q} className="rounded-lg border border-neutral-200 bg-white p-4 shadow-sm">
							<h2 className="text-base font-medium mb-1">{q}</h2>
							<p className="text-sm leading-relaxed text-neutral-600">{a}</p>
						</div>
					))}
				</div>
			</main>
			<Footer />
		</div>
	);
}
