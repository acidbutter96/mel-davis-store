import Image from "next/image";
import { Button } from "@/ui/shadcn/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { YnsLink } from "@/ui/yns-link";

export default function ForbiddenPage() {
	return (
		<main className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
			<div className="mx-auto mb-6 flex justify-center">
				<Image src="/images/meldavis.svg" alt="Mel Davis" width={100} height={100} />
			</div>
			<Card>
				<CardHeader className="text-center">
					<CardTitle className="text-3xl font-bold">Access denied</CardTitle>
				</CardHeader>
				<CardContent className="text-center space-y-4">
					<p className="text-muted-foreground">You do not have permission to view this page.</p>
					<div className="flex items-center justify-center gap-3">
						<Button asChild>
							<YnsLink href="/">Go back home</YnsLink>
						</Button>
					</div>
				</CardContent>
			</Card>
		</main>
	);
}
