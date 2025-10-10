"use client";

import { Loader2, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { adminNavItems } from "@/app/admin/_components/nav-config";
import { cn } from "@/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/ui/shadcn/sheet";

export function AdminTopbar() {
	const pathname = usePathname();
	const [navigating, setNavigating] = useState(false);
	useEffect(() => {
		setNavigating(false);
	}, [pathname]);
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
						<SheetTitle className="sr-only">Navigation menu</SheetTitle>
						<div className="px-4 py-4 border-b font-semibold">Menu</div>
						<nav className="p-2 space-y-1">
							{adminNavItems.map(({ href, label }) => {
								const active = pathname === href || (href !== "/admin" && pathname?.startsWith(href));
								return (
									<SheetClose asChild key={href}>
										<Link
											href={href}
											onClick={(e) => {
												if (active) {
													e.preventDefault();
													return;
												}
												setNavigating(true);
											}}
											className={cn(
												"block rounded-md px-3 py-2 text-sm",
												active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground",
											)}
										>
											{label}
										</Link>
									</SheetClose>
								);
							})}
						</nav>
					</SheetContent>
				</Sheet>
			</div>
			{navigating && (
				<div className="fixed inset-0 z-[60] grid place-items-center bg-background/60">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			)}
		</div>
	);
}
