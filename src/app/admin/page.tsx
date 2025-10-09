import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/ui/shadcn/table";
import { AdminFilters } from "./admin-filters.client";
export const dynamic = "force-dynamic";

import Link from "next/link";
import { PaidVsFailedDonut } from "@/ui/charts/paid-vs-failed-donut.client";
import { RevenueSparkline } from "@/ui/charts/revenue-sparkline.client";
import { RevenueZoomBrush } from "@/ui/charts/revenue-zoom-brush.client";
import { StatusBadge } from "@/ui/status-badge";

type RecentPurchase = {
	id: string;
	userEmail: string;
	amountTotal: number;
	currency: string;
	status: string;
	createdAt: string;
};

interface PurchaseDocLite {
	id?: string;
	amountTotal?: number;
	currency?: string;
	status?: string;
	createdAt?: string | Date;
}

interface UserWithPurchasesLite {
	email?: string;
	purchases?: PurchaseDocLite[];
}

type SearchParams = { status?: string | string[]; period?: string | string[]; sort?: string | string[] };

export default async function AdminPage({ searchParams }: { searchParams?: SearchParams }) {
	const session = await auth();
	if (!session) redirect("/login");
	const role = session.user.role === "admin" ? "admin" : "customer";
	if (role !== "admin") redirect("/forbidden");

	const db = await getDb();
	const usersCount = await db.collection("users").countDocuments();

	// Build filters (accept string | string[] from searchParams)
	const asStr = (v: unknown): string | undefined =>
		typeof v === "string"
			? v
			: Array.isArray(v)
				? typeof v[0] === "string"
					? (v[0] as string)
					: undefined
				: undefined;
	const status = (asStr(searchParams?.status) ?? "all").toLowerCase();
	const period = (asStr(searchParams?.period) ?? "30d").toLowerCase();
	const sort = (asStr(searchParams?.sort) ?? "date-desc").toLowerCase();

	const now = new Date();
	let since: Date | null = null;
	if (period === "7d") since = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
	else if (period === "30d") since = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	else if (period === "90d") since = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
	else if (period === "365d") since = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

	// We'll fetch users with purchases and then filter in-memory; purchases are embedded arrays in user docs.
	const lastUsers = await db
		.collection("users")
		.find({ purchases: { $exists: true, $ne: [] } }, { projection: { email: 1, purchases: 1, updatedAt: 1 } })
		.sort({ updatedAt: -1 })
		.limit(50)
		.toArray();

	const purchases: RecentPurchase[] = [];
	for (const u of lastUsers as UserWithPurchasesLite[]) {
		for (const p of u.purchases ?? ([] as PurchaseDocLite[])) {
			purchases.push({
				id: String(p.id ?? ""),
				userEmail: u.email ?? "(unknown)",
				amountTotal: typeof p.amountTotal === "number" ? p.amountTotal : 0,
				currency: typeof p.currency === "string" ? p.currency.toUpperCase() : "USD",
				status: typeof p.status === "string" ? p.status : "unknown",
				createdAt:
					typeof p.createdAt === "string"
						? p.createdAt
						: p.createdAt instanceof Date
							? p.createdAt.toISOString()
							: "",
			});
		}
	}
	// Filter by status and period
	let filtered = purchases.filter((p) => {
		const okStatus = status === "all" || p.status.toLowerCase() === status;
		const okPeriod = !since || new Date(p.createdAt).getTime() >= since.getTime();
		return okStatus && okPeriod;
	});

	// Sort
	if (sort === "date-asc") filtered.sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1));
	else if (sort === "amount-desc") filtered.sort((a, b) => b.amountTotal - a.amountTotal);
	else if (sort === "amount-asc") filtered.sort((a, b) => a.amountTotal - b.amountTotal);
	else filtered.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
	const recent = filtered.slice(0, 10);

	// Metrics: revenue (paid only), paid vs failed, and top customers
	const isPaid = (s: string) => {
		const v = s.toLowerCase();
		return v === "paid" || v === "succeeded";
	};
	const isFailed = (s: string) => s.toLowerCase() === "failed";

	const paidOnly = filtered.filter((p) => isPaid(p.status));
	const revenueCents = paidOnly.reduce(
		(sum, p) => sum + (typeof p.amountTotal === "number" ? p.amountTotal : 0),
		0,
	);
	const paidCount = paidOnly.length;
	const failedCount = filtered.filter((p) => isFailed(p.status)).length;

	// Rank users by number of purchases and total spent (paid only)
	const topMap = new Map<
		string,
		{ email: string; count: number; paidCount: number; totalSpentCents: number }
	>();
	for (const p of filtered) {
		const email = p.userEmail || "(unknown)";
		let entry = topMap.get(email);
		if (!entry) {
			entry = { email, count: 0, paidCount: 0, totalSpentCents: 0 };
			topMap.set(email, entry);
		}
		entry.count += 1;
		if (isPaid(p.status)) {
			entry.paidCount += 1;
			entry.totalSpentCents += typeof p.amountTotal === "number" ? p.amountTotal : 0;
		}
	}
	const topCustomers = Array.from(topMap.values())
		.sort((a, b) => {
			if (b.totalSpentCents !== a.totalSpentCents) return b.totalSpentCents - a.totalSpentCents;
			if (b.paidCount !== a.paidCount) return b.paidCount - a.paidCount;
			return b.count - a.count;
		})
		.slice(0, 5);

	const formatMoney = (amount: number, currency: string) => {
		try {
			return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
		} catch {
			return `${(amount / 100).toFixed(2)} ${currency}`;
		}
	};

	// Build simple revenue sparkline data (paid only)
	const effectiveSince = since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
	const dayKey = (d: Date) => d.toISOString().slice(0, 10);
	const paidByDay = new Map<string, number>();
	for (const p of paidOnly) {
		const k = dayKey(new Date(p.createdAt));
		paidByDay.set(k, (paidByDay.get(k) || 0) + p.amountTotal);
	}
	const days: string[] = [];
	for (let d = new Date(effectiveSince); d <= now; d = new Date(d.getTime() + 24 * 60 * 60 * 1000)) {
		days.push(dayKey(d));
	}
	const series = days.map((k) => paidByDay.get(k) || 0);

	// Build points for zoom/brush chart (x as timestamp, y in cents)
	const zoomBrushPoints = days.map((k) => ({ x: new Date(k).getTime(), y: paidByDay.get(k) || 0 }));

	// StatusBadge is shared in ui/status-badge

	return (
		<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 bg-background text-foreground">
			<div className="space-y-3">
				<h1 className="text-2xl font-semibold">Admin Dashboard</h1>
				<p className="text-muted-foreground">High-level overview of your store.</p>
				<AdminFilters defaultStatus={status} defaultPeriod={period} defaultSort={sort} />
			</div>

			<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{usersCount}</div>
						<div className="mt-2 text-sm">
							<Link className="underline text-primary hover:text-primary/80" href="/admin/users">
								View users
							</Link>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Revenue (paid)</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">
							{formatMoney(revenueCents, recent[0]?.currency || "USD")}
						</div>
						<div className="mt-3">
							<RevenueSparkline
								seriesCents={series}
								labels={days}
								currency={recent[0]?.currency || "USD"}
								height={80}
							/>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Paid vs Failed</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-lg font-medium mb-2">
							<span className="text-emerald-600 dark:text-emerald-400">{paidCount} paid</span>
							<span className="mx-2 text-muted-foreground">/</span>
							<span className="text-red-600 dark:text-red-400">{failedCount} failed</span>
						</div>
						<PaidVsFailedDonut paid={paidCount} failed={failedCount} height={200} />
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Filtered purchases</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{filtered.length}</div>
						<div className="mt-2 text-sm">
							<Link className="underline text-primary hover:text-primary/80" href="/admin/orders">
								View orders
							</Link>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Latest status</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-lg font-medium capitalize">{recent[0]?.status ?? "—"}</div>
					</CardContent>
				</Card>
			</section>

			<section>
				<Card>
					<CardHeader>
						<CardTitle>Recent purchases</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="w-full overflow-x-auto">
							<Table className="min-w-[720px]">
								<TableHeader>
									<TableRow>
										<TableHead>User</TableHead>
										<TableHead>Amount</TableHead>
										<TableHead>Status</TableHead>
										<TableHead>Date</TableHead>
										<TableHead>ID</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{recent.map((p) => (
										<TableRow key={p.id}>
											<TableCell>{p.userEmail}</TableCell>
											<TableCell>{formatMoney(p.amountTotal, p.currency)}</TableCell>
											<TableCell className="capitalize">
												<StatusBadge status={p.status} />
											</TableCell>
											<TableCell>{new Date(p.createdAt).toLocaleString()}</TableCell>
											<TableCell className="font-mono text-xs">{p.id}</TableCell>
										</TableRow>
									))}
									{recent.length === 0 && (
										<TableRow>
											<TableCell colSpan={5} className="text-muted-foreground py-6">
												No purchases yet.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
								<TableCaption>Showing up to the last 10 purchases.</TableCaption>
							</Table>
						</div>
					</CardContent>
				</Card>
			</section>

			<section>
				<Card>
					<CardHeader>
						<CardTitle>Revenue over time (Zoom/Brush)</CardTitle>
					</CardHeader>
					<CardContent>
						<RevenueZoomBrush points={zoomBrushPoints} currency={recent[0]?.currency || "USD"} />
					</CardContent>
				</Card>
			</section>

			<section>
				<Card>
					<CardHeader>
						<CardTitle>Top customers</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="w-full overflow-x-auto">
							<Table className="min-w-[640px]">
								<TableHeader>
									<TableRow>
										<TableHead>User</TableHead>
										<TableHead className="text-right">Orders</TableHead>
										<TableHead className="text-right">Paid</TableHead>
										<TableHead className="text-right">Total spent</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{topCustomers.map((c) => (
										<TableRow key={c.email}>
											<TableCell>{c.email}</TableCell>
											<TableCell className="text-right">{c.count}</TableCell>
											<TableCell className="text-right">{c.paidCount}</TableCell>
											<TableCell className="text-right">
												{formatMoney(c.totalSpentCents, recent[0]?.currency || "USD")}
											</TableCell>
										</TableRow>
									))}
									{topCustomers.length === 0 && (
										<TableRow>
											<TableCell colSpan={4} className="text-muted-foreground py-6">
												No customers.
											</TableCell>
										</TableRow>
									)}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
