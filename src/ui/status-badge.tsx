"use client";

import { Badge } from "@/ui/shadcn/badge";

export function StatusBadge({ status }: { status: string }) {
	const s = (status || "").toLowerCase();
	if (s === "paid" || s === "succeeded")
		return <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">{status}</Badge>;
	if (s === "failed") return <Badge className="bg-red-100 text-red-800 border-red-200">{status}</Badge>;
	if (s === "processing")
		return <Badge className="bg-amber-100 text-amber-800 border-amber-200">{status}</Badge>;
	if (s === "canceled" || s === "voided")
		return <Badge className="bg-gray-200 text-gray-800 border-gray-300">{status}</Badge>;
	return (
		<Badge variant="secondary" className="capitalize">
			{status}
		</Badge>
	);
}
