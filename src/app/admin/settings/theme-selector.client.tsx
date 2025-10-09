"use client";

import { useAdminTheme } from "@/app/admin/_components/admin-theme-provider.client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";

export function AdminThemeSelector() {
	const { theme, setTheme } = useAdminTheme();
	return (
		<div className="max-w-xs">
			<label className="block text-sm font-medium mb-2">Admin theme</label>
			<Select value={theme} onValueChange={(v) => setTheme((v as "light") || "dark")}>
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
