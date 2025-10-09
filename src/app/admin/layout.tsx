import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { auth } from "@/lib/auth";
import { AdminSidebar } from "./_components/sidebar.client";

export default async function AdminLayout({ children }: { children: ReactNode }) {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	return (
		<div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div className="flex gap-6">
				<AdminSidebar />
				<div className="flex-1 py-6 min-h-screen">{children}</div>
			</div>
		</div>
	);
}
