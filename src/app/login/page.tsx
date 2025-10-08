"use client";

import Image from "next/image";
import { useTranslations } from "@/i18n/client";
import { LoginForm } from "@/ui/login-form";

export default function LoginPage() {
	const t = useTranslations("Global.metadata");

	return (
		<div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-neutral-50 p-6 md:p-10">
			<div className="flex w-full max-w-sm flex-col gap-6">
				<a href="#" className="flex items-center gap-2 self-center text-3xl font-extrabold">
					<div className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
						<Image src="/images/meldavis.svg" alt="Meldavis logo" width={450} height={450} />
					</div>
					{t("title")}
				</a>
				<LoginForm />
			</div>
		</div>
	);
}
