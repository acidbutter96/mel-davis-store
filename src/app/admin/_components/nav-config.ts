import { LayoutDashboard, Settings, ShoppingCart, Users } from "lucide-react";

export type NavItem = { href: string; label: string; icon?: React.ComponentType<{ className?: string }> };

export const adminNavItems: NavItem[] = [
	{ href: "/admin", label: "Overview", icon: LayoutDashboard },
	{ href: "/admin/orders", label: "Orders", icon: ShoppingCart },
	{ href: "/admin/users", label: "Users", icon: Users },
	{ href: "/admin/settings", label: "Settings", icon: Settings },
];
