"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/ui/shadcn/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/ui/shadcn/select";

type FulfillmentStatus = "received" | "producing" | "shipped";

export default function UpdateFulfillment({
	id,
	current,
	statuses,
}: {
	id: string;
	current?: { status?: FulfillmentStatus; trackingNumber?: string | null };
	statuses: FulfillmentStatus[];
}) {
	const [status, setStatus] = useState<FulfillmentStatus | "">(current?.status || "");
	const [tracking, setTracking] = useState<string>(current?.trackingNumber || "");
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [ok, setOk] = useState(false);

	async function save() {
		setSaving(true);
		setError(null);
		setOk(false);
		try {
			const res = await fetch(`/api/admin/orders/${id}/fulfillment`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					status: status || undefined,
					trackingNumber: tracking.length ? tracking : null,
				}),
			});
			if (!res.ok) {
				const text = await res.text();
				throw new Error(text || "Failed");
			}
			setOk(true);
		} catch (e) {
			const message = e instanceof Error ? e.message : "Failed";
			setError(message);
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="grid gap-3">
			<div className="text-sm font-medium">Fulfillment</div>
			<div className="grid gap-2 sm:grid-cols-2">
				<div className="grid gap-1">
					<label className="text-xs text-muted-foreground">Status</label>
					<Select value={status} onValueChange={(v) => setStatus(v as FulfillmentStatus)}>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Select status" />
						</SelectTrigger>
						<SelectContent>
							{statuses.map((s) => (
								<SelectItem key={s} value={s}>
									{s}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-1">
					<label className="text-xs text-muted-foreground">Tracking number</label>
					<Input value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="e.g. 1Z..." />
				</div>
			</div>
			<div className="flex items-center gap-2">
				<Button size="sm" onClick={save} disabled={saving}>
					{saving ? "Saving..." : "Save"}
				</Button>
				{ok && <span className="text-xs text-emerald-600">Saved</span>}
				{error && <span className="text-xs text-destructive">{error}</span>}
			</div>
		</div>
	);
}
