import Image from "next/image";
import { getTranslations } from "@/i18n/server";
import { Button } from "@/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { YnsLink } from "@/ui/yns-link";

export default async function NotFound() {
	const t = await getTranslations("Global.notFound");
	return (
		<main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
			<div className="mx-auto mb-6 flex justify-center">
				<Image src="/images/meldavis.svg" alt="Mel Davis" width={100} height={100} />
			</div>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-3xl font-bold">{t("title")}</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">{t("description")}</p>
					<div className="flex items-center justify-center gap-3">
						<Button asChild>
							<YnsLink href="/">{t("goBackLink")}</YnsLink>
						</Button>
						<Button asChild variant="outline">
							<YnsLink href="/products">Browse products</YnsLink>
						</Button>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
