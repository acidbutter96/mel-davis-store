"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { adminNavItems, type NavItem } from "@/app/admin/_components/nav-config";
import { cn } from "@/lib/utils";

type SidebarUser = { name?: string | null; email?: string | null };

export function AdminSidebar({ user }: { user?: SidebarUser }) {
	const pathname = usePathname();
	return (
		<aside className="hidden md:flex md:w-60 lg:w-64 xl:w-72 flex-col border-r bg-background h-[calc(100dvh)] sticky top-0">
			<div className="px-4 py-4 border-b">
				<Link href="/admin" className="flex items-center gap-3 font-semibold text-foreground">
					<Image src="/images/meldavis.svg" width={24} height={24} alt="meldavis" />
					<span>Admin - meldavis.store</span>
				</Link>
			</div>
			<nav className="p-2 space-y-1">
				{adminNavItems.map(({ href, label, icon: Icon }: NavItem) => {
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
							{Icon ? <Icon className="h-4 w-4" /> : null}
							<span>{label}</span>
						</Link>
					);
				})}
			</nav>
			<div className="mt-auto p-4 border-t">
				<div className="text-xs text-muted-foreground">
					<div className="font-medium text-foreground">{user?.name ?? user?.email ?? "Authenticated"}</div>
					<div className="truncate">{user?.email ?? ""}</div>
				</div>
				<div className="mt-2 text-[10px] text-muted-foreground">
					<a
						href="https://devbutter.tech/"
						target="_blank"
						rel="noopener noreferrer"
						className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
						aria-label="DevButter site"
					>
						<span className="tracking-wide">Developed by DevButter</span>
						<Image
							src="/images/icons/devbutter.svg"
							alt="DevButter"
							width={14}
							height={14}
							className="h-[14px] w-[14px] object-contain"
						/>
						<span className="sr-only">DevButter</span>
					</a>
				</div>
			</div>
		</aside>
	);
}
