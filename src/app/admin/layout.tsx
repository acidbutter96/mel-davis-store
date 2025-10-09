import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "./_components/sidebar.client";
import { AdminTopbar } from "./_components/topbar.client";

export default async function AdminLayout({ children }: { children: ReactNode }) {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	return (
		<div className="mx-auto max-w-7xl">
			<AdminTopbar />
			<div className="flex gap-4 sm:gap-6 px-4 sm:px-6 lg:px-8">
				<AdminSidebar />
				<div className="flex-1 py-4 sm:py-6 min-h-screen">{children}</div>
			</div>
		</div>
	);
}
