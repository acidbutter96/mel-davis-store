import type { Metadata } from "next";
import { ContactForm } from "@/ui/contact/contact-form.client";
import { Footer } from "@/ui/footer/footer";
import { Nav } from "@/ui/nav/nav";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { YnsLink } from "@/ui/yns-link";

export const metadata: Metadata = {
	title: "Contact Us - Mel Davis Store",
	description: "Get in touch with Mel Davis Store support team.",
};

export default function ContactPage() {
	return (
		<div className="flex min-h-full flex-1 flex-col bg-white">
			<Nav />
			<main className="relative mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
				<div
					className="pointer-events-none absolute inset-0 select-none opacity-40 [mask-image:radial-gradient(circle_at_center,white,transparent_70%)]"
					aria-hidden
				/>
				<header className="mb-10 flex flex-col gap-3">
					<h1 className="text-3xl font-semibold tracking-tight">Get in Touch</h1>
					<p className="max-w-2xl text-sm text-muted-foreground leading-relaxed">
						We usually respond within 24 hours. For account or order issues include your order number so we
						can help faster.
					</p>
				</header>
				<div className="grid gap-8 lg:grid-cols-3">
					<Card className="lg:col-span-2 backdrop-blur supports-[backdrop-filter]:bg-white/70">
						<CardHeader className="pb-4">
							<CardTitle className="text-base">Send a Message</CardTitle>
							<CardDescription>Fill the form and we will get back to you shortly.</CardDescription>
						</CardHeader>
						<CardContent className="pt-2">
							<ContactForm />
						</CardContent>
					</Card>
					<div className="space-y-8">
						<Card className="backdrop-blur supports-[backdrop-filter]:bg-white/70">
							<CardHeader className="pb-4">
								<CardTitle className="text-base">Contact Information</CardTitle>
								<CardDescription>Ways to reach our support team.</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 text-sm">
								<ul className="space-y-2">
									<li>
										<span className="font-medium">Email:</span>{" "}
										<YnsLink href="mailto:support@example.com">support@example.com</YnsLink>
									</li>
									<li>
										<span className="font-medium">Phone:</span> (000) 000-0000
									</li>
									<li>
										<span className="font-medium">Hours:</span> Mon–Fri, 9am–5pm (UTC)
									</li>
								</ul>
							</CardContent>
						</Card>
						<Card className="backdrop-blur supports-[backdrop-filter]:bg-white/70">
							<CardHeader className="pb-4">
								<CardTitle className="text-base">Helpful Links</CardTitle>
								<CardDescription>Quick access to useful resources.</CardDescription>
							</CardHeader>
							<CardContent className="pt-2 text-sm">
								<ul className="space-y-1">
									<li>
										<YnsLink href="/faq">FAQ</YnsLink>
									</li>
									<li>
										<YnsLink href="/terms">Terms of Service</YnsLink>
									</li>
									<li>
										<YnsLink href="/privacy">Privacy Policy</YnsLink>
									</li>
								</ul>
								<p className="mt-4 text-xs text-muted-foreground">
									This form is a demo. Don’t send sensitive data.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			</main>
			<Footer />
		</div>
	);
}
