"use client";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// (Textarea removed - not used)

interface UserProfileData {
	_id: string;
	name?: string;
	email: string;
	phone?: string;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
}

interface Props {
	userId: string;
	initial: UserProfileData;
	onSessionEmailChange?: (newEmail: string) => void;
}

type Status = { type: "idle" } | { type: "saving" } | { type: "saved" } | { type: "error"; message: string };

export function ProfileEditor({ userId, initial, onSessionEmailChange }: Props) {
	const [form, setForm] = useState<UserProfileData>(initial);
	const [status, setStatus] = useState<Status>({ type: "idle" });
	const [dirty, setDirty] = useState(false);

	const updateField = useCallback(<K extends keyof UserProfileData>(key: K, value: UserProfileData[K]) => {
		setForm((prev) => ({ ...prev, [key]: value }));
		setDirty(true);
	}, []);

	const updateAddress = useCallback(
		<K extends keyof NonNullable<UserProfileData["address"]>>(key: K, value: string) => {
			setForm((prev) => ({ ...prev, address: { ...prev.address, [key]: value } }));
			setDirty(true);
		},
		[],
	);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		if (!dirty) return;
		setStatus({ type: "saving" });
		try {
			const payload: Record<string, unknown> = {
				name: form.name,
				email: form.email,
				phone: form.phone,
				address: form.address,
			};
			// remove empty fields
			Object.keys(payload).forEach((k) => {
				// @ts-ignore
				if (payload[k] == null || payload[k] === "") delete payload[k];
			});
			const res = await fetch(`/api/users/${userId}`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				const errJson = (await res.json().catch(() => ({}))) as { error?: string };
				throw new Error(errJson.error || "Failed to save");
			}
			const saved = (await res.json()) as UserProfileData;
			setForm(saved);
			setStatus({ type: "saved" });
			setDirty(false);
			if (saved.email !== initial.email && onSessionEmailChange) {
				onSessionEmailChange(saved.email);
			}
			// reset saved indicator
			setTimeout(() => setStatus({ type: "idle" }), 2500);
		} catch (err: unknown) {
			const message = err instanceof Error ? err.message : "Unknown error";
			setStatus({ type: "error", message });
		}
	}

	// automatic feedback for error/success states
	let banner: React.ReactNode = null;
	if (status.type === "saving") banner = <p className="text-xs text-muted-foreground">Saving...</p>;
	if (status.type === "saved") banner = <p className="text-xs text-green-600">Saved!</p>;
	if (status.type === "error") banner = <p className="text-xs text-destructive">{status.message}</p>;

	return (
		<form onSubmit={handleSubmit} className="space-y-6" noValidate>
			<div className="grid gap-4 md:grid-cols-2">
				<div className="space-y-2">
					<Label htmlFor="name">Name</Label>
					<Input id="name" value={form.name || ""} onChange={(e) => updateField("name", e.target.value)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="email">Email</Label>
					<Input
						id="email"
						type="email"
						value={form.email}
						onChange={(e) => updateField("email", e.target.value)}
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="phone">Phone</Label>
					<Input id="phone" value={form.phone || ""} onChange={(e) => updateField("phone", e.target.value)} />
				</div>
				<div className="space-y-2">
					<Label htmlFor="line1">Address Line 1</Label>
					<Input
						id="line1"
						value={form.address?.line1 || ""}
						onChange={(e) => updateAddress("line1", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="line2">Address Line 2</Label>
					<Input
						id="line2"
						value={form.address?.line2 || ""}
						onChange={(e) => updateAddress("line2", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="city">City</Label>
					<Input
						id="city"
						value={form.address?.city || ""}
						onChange={(e) => updateAddress("city", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="state">State</Label>
					<Input
						id="state"
						value={form.address?.state || ""}
						onChange={(e) => updateAddress("state", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="postalCode">Postal Code</Label>
					<Input
						id="postalCode"
						value={form.address?.postalCode || ""}
						onChange={(e) => updateAddress("postalCode", e.target.value)}
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="country">Country</Label>
					<Input
						id="country"
						value={form.address?.country || ""}
						onChange={(e) => updateAddress("country", e.target.value.toUpperCase())}
					/>
				</div>
			</div>
			<div className="flex items-center gap-4">
				<Button type="submit" disabled={status.type === "saving" || !dirty}>
					{status.type === "saving" ? "Saving..." : dirty ? "Save" : "Saved"}
				</Button>
				{banner}
			</div>
		</form>
	);
}
