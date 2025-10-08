import type { Metadata } from "next";
import { AboutSection } from "@/ui/about-section";
import { Footer } from "@/ui/footer/footer";
import { Nav } from "@/ui/nav/nav";

export const metadata: Metadata = {
	title: "About - Mel Davis",
	description: "About Mel Davis and the story behind the store",
};

export default async function AboutPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col bg-white">
			<Nav />
			<main className="mx-auto w-full max-w-7xl p-0">
				<AboutSection headingTag="h1" showReadMore={false} imageSrc="/images/meldavis.svg" />
			</main>
			<Footer />
		</div>
	);
}
