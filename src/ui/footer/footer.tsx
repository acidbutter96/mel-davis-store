import Image from "next/image";
import { getTranslations } from "@/i18n/server";
import { getStripeCategories } from "@/lib/stripe-categories";
import { Newsletter } from "@/ui/footer/newsletter.client";
import { YnsLink } from "@/ui/yns-link";

const paymentIcons = [
	{ label: "Stripe", src: "/images/icons/stripe.svg" },
	{ label: "Visa", src: "/images/icons/visa.svg" },
	{ label: "Mastercard", src: "/images/icons/mastercard.svg" },
	{ label: "American Express", src: "/images/icons/amex.svg" },
	{ label: "Apple Pay", src: "/images/icons/apple-pay.svg" },
	{ label: "Google Pay", src: "/images/icons/google-pay.svg" },
	{ label: "Amazon Pay", src: "/images/icons/amazon-pay.svg" },
];

export async function Footer() {
	const t = await getTranslations("Global.footer");
	const year = new Date().getFullYear();

	const dynamicCategories = await getStripeCategories();

	const sections = [
		{
			header: "Products",
			links: dynamicCategories.map(({ name, slug }) => ({ label: name, href: `/category/${slug}` })),
		},
		{
			header: "Support",
			links: [
				{ label: "FAQ", href: "/faq" },
				{ label: "Contact Us", href: "/contact" },
			],
		},
		{
			header: "Legal",
			links: [
				{ label: "Terms", href: "/terms" },
				{ label: "Privacy", href: "/privacy" },
			],
		},
	];

	return (
		<footer className="w-full bg-neutral-50 p-6 text-neutral-800 md:py-12">
			<div className="container flex max-w-7xl flex-row flex-wrap justify-center gap-16 text-sm sm:justify-between">
				<div className="">
					<div className="flex w-full max-w-sm flex-col gap-2">
						<h3 className="font-semibold">{t("newsletterTitle")}</h3>
						<Newsletter />
					</div>
				</div>

				<nav className="grid grid-cols-2 gap-16">
					{sections.map((section) => (
						<section key={section.header}>
							<h3 className="mb-2 font-semibold">{section.header}</h3>
							<ul role="list" className="grid gap-1">
								{section.links.map((link) => (
									<li key={link.label}>
										<YnsLink className="underline-offset-4 hover:underline" href={link.href}>
											{link.label}
										</YnsLink>
									</li>
								))}
							</ul>
						</section>
					))}
				</nav>
			</div>

			<div className="container mt-8 flex max-w-7xl flex-col items-center justify-between gap-4 text-sm text-neutral-500 md:flex-row">
				<div className="hidden lg:block order-1 w-full md:w-auto md:max-w-lg">
					<p className="font-medium font-['Roboto',sans-serif] text-center md:text-left flex items-center">
						<span>Copyright &copy; {year} All Rights Reserved. | Developed By</span>
						<a
							className="inline-flex items-center ml-1 hover:text-neutral-700 transition-colors"
							href="https://devbutter.tech/"
							target="_blank"
							rel="noopener noreferrer"
							aria-label="DevButter site"
						>
							<Image
								src="/images/icons/devbutter.svg"
								alt="DevButter"
								width={18}
								height={18}
								className="h-[18px] w-[18px] object-contain"
							/>
							<span className="sr-only">DevButter</span>
						</a>
					</p>
				</div>

				<div className="order-2 flex w-full items-center justify-center lg:order-3 md:w-auto md:justify-end">
					<ul
						className="flex flex-wrap items-center justify-center gap-4 md:flex-nowrap md:justify-end whitespace-nowrap"
						aria-label="Accepted payment methods"
					>
						{paymentIcons.map((icon) => (
							<li key={icon.label} className="flex">
								<span className="inline-flex" title={icon.label} aria-label={icon.label}>
									<Image
										src={icon.src}
										alt={icon.label}
										width={52}
										height={32}
										className="h-8 w-auto object-contain opacity-80 transition-opacity hover:opacity-100"
									/>
									<span className="sr-only">{icon.label}</span>
								</span>
							</li>
						))}
					</ul>
				</div>

				<div className="order-3 flex items-center lg:order-2 lg:hidden">
					<a
						href="https://devbutter.tech/"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-2 transition-colors hover:text-neutral-700"
						aria-label="Open DevButter site in a new tab"
					>
						<span className="text-xs uppercase tracking-wide lg:hidden">
							Copyright &copy; {year}. DevButter
						</span>
						<Image
							src="/images/icons/devbutter.svg"
							width={24}
							height={24}
							alt="DevButter"
							className="h-6 w-6 object-contain"
						/>
						<span className="sr-only">DevButter</span>
					</a>
				</div>
			</div>
		</footer>
	);
}
