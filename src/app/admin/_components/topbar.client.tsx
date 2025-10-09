"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems } from "@/app/admin/_components/nav-config";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetTrigger } from "@/ui/shadcn/sheet";

export function AdminTopbar() {
	const pathname = usePathname();
	return (
		<div className="md:hidden sticky top-0 z-40 border-b bg-background">
			<div className="flex h-14 items-center justify-between px-4">
				<Link href="/admin" className="font-semibold">
					Admin
				</Link>
				<Sheet>
					<SheetTrigger className="inline-flex items-center justify-center rounded-md p-2 hover:bg-muted">
						<Menu className="h-5 w-5" />
						<span className="sr-only">Open menu</span>
					</SheetTrigger>
					<SheetContent side="left" className="p-0">
						<div className="px-4 py-4 border-b font-semibold">Menu</div>
						<nav className="p-2 space-y-1">
							{adminNavItems.map(({ href, label }) => {
								const active = pathname === href || (href !== "/admin" && pathname?.startsWith(href));
								return (
									<Link
										key={href}
										href={href}
										className={cn(
											"block rounded-md px-3 py-2 text-sm",
											active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground",
										)}
									>
										{label}
									</Link>
								);
							})}
						</nav>
					</SheetContent>
				</Sheet>
			</div>
		</div>
	);
}
