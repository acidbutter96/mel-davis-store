"use client";

import type React from "react";
import { createContext, useContext, useEffect, useMemo, useState } from "react";

type AdminTheme = "light" | "dark";
type Ctx = { theme: AdminTheme; setTheme: (t: AdminTheme) => void };

const AdminThemeContext = createContext<Ctx | null>(null);
const STORAGE_KEY = "admin-theme";

export function AdminThemeProvider({ children }: { children: React.ReactNode }) {
	const [theme, setTheme] = useState<AdminTheme>(() => {
		if (typeof window === "undefined") return "light";
		const saved = window.localStorage.getItem(STORAGE_KEY);
		return saved === "dark" || saved === "light" ? (saved as AdminTheme) : "light";
	});

	useEffect(() => {
		try {
			window.localStorage.setItem(STORAGE_KEY, theme);
		} catch {}
	}, [theme]);

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
