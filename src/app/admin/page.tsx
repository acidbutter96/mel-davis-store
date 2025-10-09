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

	const formatMoney = (amount: number, currency: string) => {
		try {
			return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount / 100);
		} catch {
			return `${(amount / 100).toFixed(2)} ${currency}`;
		}
	};

	return (
		<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
			<div className="space-y-3">
				<h1 className="text-2xl font-semibold">Admin Dashboard</h1>
				<p className="text-muted-foreground">High-level overview of your store.</p>
				<AdminFilters defaultStatus={status} defaultPeriod={period} defaultSort={sort} />
			</div>

			<section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Users</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{usersCount}</div>
						<div className="mt-2 text-sm">
							<Link className="underline" href="/admin/users">
								View users
							</Link>
						</div>
					</CardContent>
				</Card>
				<Card>
					<CardHeader>
						<CardTitle className="text-sm text-muted-foreground">Total purchases (last 10 shown)</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="text-3xl font-bold">{purchases.length}</div>
						<div className="mt-2 text-sm">
							<Link className="underline" href="/admin/orders">
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
						<Table>
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
										<TableCell className="capitalize">{p.status}</TableCell>
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
					</CardContent>
				</Card>
			</section>
		</main>
	);
}
