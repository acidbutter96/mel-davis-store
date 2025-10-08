import Image from "next/image";
import type { ElementType } from "react";
import { YnsLink } from "@/ui/yns-link";

export const ABOUT_TEXT = `Melissa Davis is an acrylic and oil painter based in New Orleans, Lousiana. Davis is known for her use of ethereal light and color, often mixing natural and otherworldly elements. Her work spans themes of connection, spiritual rejuvination, and exploration of the psyche. The world she paints often originates from spontaneous visions and psychedelic insights. Davis feels called to use art as a way to empower others to remember and stay true to their inner light.

You can usually find Mel painting at her booth and selling her work at the Art Garden and Art Bazaar in New Orleans Wednesday through Saturday. She also gigs as a muralist, live painter, and face painter at private events and festivals throughout the southern United States.
`;

type AboutSectionProps = {
	className?: string;
	showReadMore?: boolean;
	headingTag?: "h1" | "h2";
	imageSrc?: string;
};

export function AboutSection({
	className,
	showReadMore = true,
	headingTag = "h2",
	imageSrc = "/images/meldavis.svg",
}: AboutSectionProps) {
	const Heading: ElementType = headingTag;

	return (
		<section className={className ?? "rounded bg-neutral-100 py-8 sm:py-12"}>
			<div className="mx-auto grid grid-cols-1 items-center gap-8 px-8 sm:px-16 md:grid-cols-2 max-w-7xl">
				<div className="flex justify-center md:justify-start">
					<Image
						src={imageSrc}
						alt="Mel Davis"
						width={420}
						height={420}
						className="rounded"
						style={{ objectFit: "cover" }}
						priority={false}
					/>
				</div>

				<div className="max-w-md space-y-4">
					<Heading className="text-3xl font-extrabold mb-2">About me</Heading>
					<p className="text-muted-foreground">{ABOUT_TEXT}</p>
					{showReadMore && (
						<p className="mt-4">
							<YnsLink className="underline" href="/about">
								Read more
							</YnsLink>
						</p>
					)}
				</div>
			</div>
		</section>
	);
}
