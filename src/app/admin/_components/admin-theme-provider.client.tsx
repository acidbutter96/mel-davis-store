"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AdminTheme = "light" | "dark";
type Ctx = { theme: AdminTheme; setTheme: (t: AdminTheme) => void };

const AdminThemeContext = createContext<Ctx | null>(null);

export function AdminThemeProvider({
	children,
	initialTheme = "light",
}: {
	children: React.ReactNode;
	initialTheme?: AdminTheme;
}) {
	const [theme, _setTheme] = useState<AdminTheme>(initialTheme);

	// Reconcile theme from API on mount to ensure client matches Mongo
	useEffect(() => {
		let cancelled = false;
		(async () => {
			try {
				const res = await fetch("/api/admin/settings", { credentials: "include" });
				if (!res.ok) return;
				const data = (await res.json()) as { current?: { theme?: AdminTheme } };
				const next = data.current?.theme;
				if (!cancelled && (next === "light" || next === "dark") && next !== theme) {
					_setTheme(next);
				}
			} catch {
				// ignore network errors; keep current theme
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	// Also reflect theme on <html> so portals and base styles respond.
	useEffect(() => {
		const root = document.documentElement;
		const hadDark = root.classList.contains("dark");
		const marker = "data-admin-theme-active";
		root.setAttribute(marker, "true");
		if (theme === "dark") root.classList.add("dark");
		else root.classList.remove("dark");
		return () => {
			// Only restore if this provider set it
			if (root.getAttribute(marker)) {
				root.classList.toggle("dark", hadDark);
				root.removeAttribute(marker);
			}
		};
	}, [theme]);

	const setTheme = (t: AdminTheme) => {
		const prev = theme;
		_setTheme(t);
		// Persist to API (DB) with audit history
		fetch("/api/admin/settings", {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			credentials: "include",
			body: JSON.stringify({ theme: t }),
		}).catch(() => {
			// Revert on failure
			_setTheme(prev);
		});
	};

	const value = useMemo(() => ({ theme, setTheme }), [theme]);

	return (
		<AdminThemeContext.Provider value={value}>
			<div className={theme === "dark" ? "dark" : undefined}>{children}</div>
		</AdminThemeContext.Provider>
	);
}

export function useAdminTheme() {
	const ctx = useContext(AdminThemeContext);
	if (!ctx) throw new Error("useAdminTheme must be used within AdminThemeProvider");
	return ctx;
}
