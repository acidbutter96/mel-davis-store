"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { adminNavItems } from "./nav-config";

export function AdminSidebar() {
	const pathname = usePathname();
	return (
		<aside className="hidden md:flex md:w-60 lg:w-64 xl:w-72 flex-col border-r bg-background h-[calc(100dvh)] sticky top-0">
			<div className="px-4 py-4 border-b">
				<Link href="/admin" className="flex items-center gap-2 font-semibold">
					<span className="inline-block h-6 w-6 rounded bg-primary/10" />
					<span>Admin</span>
				</Link>
			</div>
			<nav className="p-2 space-y-1">
				{adminNavItems.map(({ href, label, icon: Icon }) => {
					const active = pathname === href || (href !== "/admin" && pathname?.startsWith(href));
					return (
						<Link
							key={href}
							href={href}
							className={cn(
								"flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
								active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground",
							)}
						>
							<Icon className="h-4 w-4" />
							<span>{label}</span>
						</Link>
					);
				})}
			</nav>
			<div className="mt-auto p-4 text-xs text-muted-foreground">© {new Date().getFullYear()} Admin</div>
		</aside>
	);
}
