"use client";

import { useAdminTheme } from "@/app/admin/_components/admin-theme-provider.client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";

export function AdminThemeSelector() {
	const { theme, setTheme } = useAdminTheme();
	return (
		<div className="max-w-xs">
			<label className="block text-sm font-medium mb-2">Admin theme</label>
			<Select
				value={theme}
				onValueChange={async (v) => {
					const next = (v as "light" | "dark") ?? "light";
					setTheme(next); // updates context + persists to DB via provider
				}}
			>
				<SelectTrigger>
					<SelectValue placeholder="Select theme" />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value="light">Light</SelectItem>
					<SelectItem value="dark">Dark</SelectItem>
				</SelectContent>
			</Select>
		</div>
	);
}
