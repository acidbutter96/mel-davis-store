"use client";

import { useState } from "react";
import { getPurchaseDetails } from "@/actions/order-actions";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/ui/shadcn/dialog";

interface PurchaseSummaryItem {
	name?: string | null;
	quantity: number;
	unitAmount?: number | null;
	priceId?: string | null;
}
interface PurchaseSummary {
	id: string;
	createdAt: Date | string;
	status: string;
	amountTotal: number;
	currency: string;
	items: PurchaseSummaryItem[];
}
interface PurchaseDetailsItem {
	name: string | null;
	quantity: number;
	unitAmount: number | null;
	priceId: string | null;
	productId: string | null;
	image: string | null;
}
interface PurchaseDetails {
	id: string;
	status: string;
	createdAt: Date | string;
	amountTotal: number;
	currency: string;
	items: PurchaseDetailsItem[];
}

export function PurchasesGrid({ purchases }: { purchases: PurchaseSummary[] }) {
	const [open, setOpen] = useState(false);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [details, setDetails] = useState<PurchaseDetails | null>(null);

	function formatCurrency(amountCents: number, currency: string) {
		const amount = amountCents / 100;
		try {
			return new Intl.NumberFormat("en-US", {
				style: "currency",
				currency,
				currencyDisplay: "symbol",
				minimumFractionDigits: 2,
				maximumFractionDigits: 2,
			}).format(amount);
		} catch {
			return `$${(amount || 0).toFixed(2)}`;
		}
	}

	function formatDate(value: Date | string) {
		const d = typeof value === "string" ? new Date(value) : value;
		return new Intl.DateTimeFormat("en-US", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			hour12: false,
			timeZone: "UTC",
		}).format(d);
	}
	const statusStyle: Record<string, string> = {
		paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
		succeeded: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
		unpaid: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
		open: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
		processing: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
		refunded: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30",
		canceled: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30",
		default: "bg-muted text-muted-foreground border-border",
	};
	const iconStyle: Record<string, React.ReactNode> = {
		paid: (
			<span className="inline-block size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]" />
		),
		succeeded: (
			<span className="inline-block size-2 rounded-full bg-emerald-500 shadow-[0_0_0_3px_rgba(16,185,129,0.35)]" />
		),
		unpaid: (
			<span className="inline-block size-2 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.35)]" />
		),
		open: (
			<span className="inline-block size-2 rounded-full bg-amber-500 shadow-[0_0_0_3px_rgba(245,158,11,0.35)]" />
		),
		processing: (
			<span className="inline-block size-2 rounded-full bg-sky-500 shadow-[0_0_0_3px_rgba(14,165,233,0.35)]" />
		),
		refunded: (
			<span className="inline-block size-2 rounded-full bg-indigo-500 shadow-[0_0_0_3px_rgba(99,102,241,0.35)]" />
		),
		canceled: (
			<span className="inline-block size-2 rounded-full bg-rose-500 shadow-[0_0_0_3px_rgba(244,63,94,0.35)]" />
		),
		default: <span className="inline-block size-2 rounded-full bg-muted-foreground/40" />,
	};

	async function openDetails(id: string) {
		setLoading(true);
		setError(null);
		setDetails(null);
		setOpen(true);
		const res = await getPurchaseDetails(id);
		if ("error" in res) setError(res.error);
		else setDetails(res);
		setLoading(false);
	}

	return (
		<>
			<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
				{purchases.map((p) => {
					const statusLower = p.status.toLowerCase();
					const badgeCls = statusStyle[statusLower] || statusStyle.default;
					return (
						<button
							type="button"
							key={p.id}
							onClick={() => openDetails(p.id)}
							className="cursor-pointer text-left group relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-background/40 p-5 shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/20"
						>
							<div className="flex items-start justify-between gap-3">
								<div className="min-w-0 space-y-1">
									<p className="truncate text-xs font-mono text-muted-foreground/70">{p.id}</p>
									<p className="text-sm font-semibold tracking-tight">
										{formatCurrency(p.amountTotal, p.currency)}
									</p>
								</div>
								<span
									className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide backdrop-blur-sm transition-colors ${badgeCls}`}
								>
									{iconStyle[statusLower] || iconStyle.default}
									{statusLower}
								</span>
							</div>
							<div className="mt-3 flex flex-col gap-2 text-xs text-muted-foreground">
								<div>{formatDate(p.createdAt)}</div>
								<div className="flex flex-wrap gap-1.5">
									{p.items.slice(0, 4).map((it, idx2) => (
										<span
											key={idx2}
											className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:bg-muted/70"
										>
											{(it.name || it.priceId || "Item").slice(0, 22)}
											{it.quantity > 1 && <span className="ml-1 opacity-70">×{it.quantity}</span>}
										</span>
									))}
									{p.items.length > 4 && (
										<span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground group-hover:bg-muted/70">
											+{p.items.length - 4}
										</span>
									)}
								</div>
							</div>
							<div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/0 transition group-hover:ring-black/5 dark:group-hover:ring-white/5" />
						</button>
					);
				})}
			</div>
			<Dialog
				open={open}
				onOpenChange={(o) => {
					if (!o) {
						setOpen(false);
					}
				}}
			>
				<DialogContent className="max-w-2xl">
					<DialogHeader>
						<DialogTitle>Order details</DialogTitle>
					</DialogHeader>
					{loading && <div className="py-10 text-center text-sm text-muted-foreground">Loading...</div>}
					{error && !loading && <div className="py-6 text-sm text-destructive">{error}</div>}
					{details && !loading && (
						<div className="space-y-6">
							<div className="flex flex-col gap-2 text-sm">
								{/* <div className="font-mono text-xs text-muted-foreground">{details.id}</div> */}
								<div className="text-lg font-semibold">
									{formatCurrency(details.amountTotal, details.currency)}
								</div>
								<div className="text-xs text-muted-foreground flex flex-wrap gap-2">
									<span>Status: {details.status}</span>
									<span>{formatDate(details.createdAt)}</span>
								</div>
							</div>
							<div className="divide-y rounded-md border">
								{details.items.map((it, idx) => (
									<div key={idx} className="flex items-center gap-4 p-3">
										{it.image && (
											<img
												src={it.image}
												alt={it.name || "Product"}
												className="size-14 rounded object-cover"
											/>
										)}
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium truncate">{it.name || it.priceId || "Item"}</p>
											<p className="text-xs text-muted-foreground">Qty: {it.quantity}</p>
										</div>
										<div className="text-sm font-semibold tabular-nums">
											{it.unitAmount != null ? formatCurrency(it.unitAmount, details.currency) : "-"}
										</div>
									</div>
								))}
							</div>
							<div className="flex justify-end pt-2">
								<Button size="sm" variant="outline" onClick={() => setOpen(false)}>
									Close
								</Button>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
