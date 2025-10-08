"use client";

import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/i18n/client";
import { LoginForm } from "@/ui/login-form";

export default function LoginPage() {
	const t = useTranslations("Global.metadata");

	return (
		<div className="relative flex min-h-svh flex-col items-center justify-center gap-6 bg-neutral-50 p-6 md:p-10">
			<Link
				aria-label="Back to homepage"
				href="/"
				className="absolute left-4 top-4 md:left-8 md:top-8 inline-flex h-9 w-9 items-center justify-center rounded-md border border-neutral-200 bg-white/80 text-neutral-700 shadow hover:bg-white hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary transition"
			>
				<ArrowLeft className="h-5 w-5" />
				<span className="sr-only">Back</span>
			</Link>

			<div className="flex w-full max-w-sm flex-col gap-6">
				<Link
					href="/"
					className="flex items-center gap-2 self-center text-3xl font-extrabold hover:opacity-90 transition"
				>
					<div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<Image src="/images/meldavis.svg" alt="Meldavis logo" width={450} height={450} />
					</div>
					{t("title")}
				</Link>
				<LoginForm />
			</div>
		</div>
	);
}
