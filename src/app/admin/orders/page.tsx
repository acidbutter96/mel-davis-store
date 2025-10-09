import Link from "next/link";
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
import { AdminFilters } from "../admin-filters.client";
export const dynamic = "force-dynamic";

import { StatusBadge } from "@/ui/status-badge";

type SearchParams = { status?: string | string[]; period?: string | string[]; sort?: string | string[] };

export default async function AdminOrdersPage({ searchParams }: { searchParams?: SearchParams }) {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	const db = await getDb();
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

	const pipeline: Record<string, unknown>[] = [
		{ $match: { purchases: { $exists: true, $ne: [] } } },
		{ $project: { email: 1, purchases: 1 } },
		{ $unwind: "$purchases" },
	];

	const match: Record<string, unknown> = {};
	if (status !== "all") match["purchases.status"] = status;
	if (since) match["purchases.createdAt"] = { $gte: since };
	if (Object.keys(match).length) pipeline.push({ $match: match });

	let sortStage: Record<string, 1 | -1> = { "purchases.createdAt": -1 };
	if (sort === "date-asc") sortStage = { "purchases.createdAt": 1 };
	if (sort === "amount-desc") sortStage = { "purchases.amountTotal": -1 };
	if (sort === "amount-asc") sortStage = { "purchases.amountTotal": 1 };
	pipeline.push({ $sort: sortStage }, { $limit: 50 });

	interface AggOrderItem {
		email: string;
		purchases: {
			id: string;
			amountTotal: number;
			currency: string;
			status: string;
			createdAt: string | Date;
		};
	}
	const items = (await db.collection("users").aggregate(pipeline).toArray()) as unknown as AggOrderItem[];

	return (
		<main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
			<div className="space-y-2">
				<h1 className="text-2xl font-semibold">Orders</h1>
				<AdminFilters defaultStatus={status} defaultPeriod={period} defaultSort={sort} />
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Recent orders</CardTitle>
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
								<TableHead></TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{items.map((it: AggOrderItem) => (
								<TableRow key={it.purchases.id}>
									<TableCell>{it.email}</TableCell>
									<TableCell>
										{new Intl.NumberFormat("en-US", {
											style: "currency",
											currency: it.purchases.currency?.toUpperCase?.() || "USD",
										}).format((it.purchases.amountTotal || 0) / 100)}
									</TableCell>
									<TableCell className="capitalize">
										<StatusBadge status={it.purchases.status} />
									</TableCell>
									<TableCell>{new Date(it.purchases.createdAt).toLocaleString()}</TableCell>
									<TableCell className="font-mono text-xs">{it.purchases.id}</TableCell>
									<TableCell className="text-right">
										<Link className="underline" href={`/admin/orders/${it.purchases.id}`}>
											Details
										</Link>
									</TableCell>
								</TableRow>
							))}
							{items.length === 0 && (
								<TableRow>
									<TableCell colSpan={6} className="text-muted-foreground py-6">
										No orders found.
									</TableCell>
								</TableRow>
							)}
						</TableBody>
						<TableCaption>Showing up to 50 orders.</TableCaption>
					</Table>
				</CardContent>
			</Card>
		</main>
	);
}
