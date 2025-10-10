import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminThemeProvider } from "@/app/admin/_components/admin-theme-provider.client";
import { AdminSidebar } from "@/app/admin/_components/sidebar.client";
import { AdminTopbar } from "@/app/admin/_components/topbar.client";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	let initialTheme: "light" | "dark" = "light";
	try {
		const db = await getDb();
		const doc = await db.collection<{ current?: { theme?: "light" | "dark" } }>("settings").findOne({});
		if (doc?.current?.theme === "dark" || doc?.current?.theme === "light") initialTheme = doc.current.theme;
	} catch {}

	return (
		<AdminThemeProvider initialTheme={initialTheme}>
			{/* Ensure admin pages inherit background/foreground for light/dark from the provider */}
			<div className="min-h-dvh bg-background text-foreground">
				<div className="mx-auto max-w-full sm:max-w-screen-md lg:max-w-5xl">
					<AdminTopbar />
					<div className="flex gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8">
						<AdminSidebar user={{ name: session.user.name, email: session.user.email }} />
						<div className="flex-1 py-4 sm:py-6 min-h-screen">
							<div className="mb-3">
								<Link
									href="/"
									className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
								>
									<ArrowLeft className="h-4 w-4" />
									Back to home
								</Link>
							</div>
							{children}
						</div>
					</div>
				</div>
			</div>
		</AdminThemeProvider>
	);
}
