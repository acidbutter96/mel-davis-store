"use client";
import React, { useEffect, useState } from "react";

export function AdminSupportEmail() {
	const [email, setEmail] = useState("");
	const [loading, setLoading] = useState(false);
	const [status, setStatus] = useState<string | null>(null);

	useEffect(() => {
		let mounted = true;
		async function load() {
			try {
				const res = await fetch("/api/admin/settings");
				const data = (await res.json()) as { current?: { supportEmail?: string } } | null;
				if (mounted) setEmail(data?.current?.supportEmail ?? "");
			} catch (e) {}
		}
		load();
		return () => {
			mounted = false;
		};
	}, []);

	async function save() {
		setLoading(true);
		setStatus(null);
		try {
			const res = await fetch("/api/admin/settings", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ supportEmail: email || null }),
				credentials: "include",
			});
			if (res.ok) {
				setStatus("Saved");
			} else {
				setStatus("Failed to save");
			}
		} catch (e) {
			setStatus("Failed to save");
		}
		setLoading(false);
		setTimeout(() => setStatus(null), 3000);
	}

	return (
		<div className="space-y-2">
			<label className="block text-sm font-medium">Support email</label>
			<div className="flex gap-2">
				<input
					value={email ?? ""}
					onChange={(e) => setEmail(e.target.value)}
					placeholder="support@example.com"
					className="flex-1 rounded border px-3 py-2 bg-background text-foreground"
				/>
				<button onClick={save} disabled={loading} className="rounded bg-primary px-3 py-2 text-white">
					Save
				</button>
			</div>
			{status && <div className="text-sm text-muted-foreground">{status}</div>}
		</div>
	);
}

export default AdminSupportEmail;
