import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";
import { StatusBadge } from "@/ui/status-badge";

export default async function AdminOrderDetails({ params }: { params: { id: string } }) {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	const purchaseId = params?.id;
	if (!purchaseId) redirect("/admin/orders");

	const db = await getDb();
	const pipeline = [
		{ $match: { purchases: { $exists: true, $ne: [] } } },
		{ $project: { email: 1, purchases: 1 } },
		{ $unwind: "$purchases" },
		{ $match: { "purchases.id": purchaseId } },
		{ $limit: 1 },
	];
	const docs = await db.collection("users").aggregate(pipeline).toArray();
	const doc = docs[0];
	if (!doc) redirect("/admin/orders");

	const p = doc.purchases as {
		id: string;
		amountTotal: number;
		currency: string;
		status: string;
		createdAt: string | Date;
		items?: Array<{ name?: string | null; quantity: number; unitAmount?: number | null }>;
	};

	return (
		<main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">Order details</h1>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Summary</CardTitle>
				</CardHeader>
				<CardContent className="space-y-2">
					<div>
						<span className="text-muted-foreground">ID:</span>{" "}
						<span className="font-mono text-sm break-all">{p.id}</span>
					</div>
					<div>
						<span className="text-muted-foreground">User:</span>{" "}
						<span className="break-all">{doc.email}</span>
					</div>
					<div className="flex items-center gap-2">
						<span className="text-muted-foreground">Status:</span>
						<StatusBadge status={p.status} />
					</div>
					<div>
						<span className="text-muted-foreground">Amount:</span>{" "}
						{new Intl.NumberFormat("en-US", {
							style: "currency",
							currency: p.currency?.toUpperCase?.() || "USD",
						}).format((p.amountTotal || 0) / 100)}
					</div>
					<div>
						<span className="text-muted-foreground">Date:</span> {new Date(p.createdAt).toLocaleString()}
					</div>
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Items</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="divide-y">
						{(p.items || []).map((it, idx) => (
							<li key={idx} className="py-2 flex items-center justify-between gap-3">
								<div className="min-w-0">
									<div className="font-medium break-words">{it.name || "—"}</div>
									<div className="text-sm text-muted-foreground">Qty: {it.quantity}</div>
								</div>
								<div className="text-sm">
									{typeof it.unitAmount === "number"
										? new Intl.NumberFormat("en-US", {
												style: "currency",
												currency: p.currency?.toUpperCase?.() || "USD",
											}).format(it.unitAmount / 100)
										: "—"}
								</div>
							</li>
						))}
						{(p.items || []).length === 0 && <li className="py-6 text-muted-foreground">No items.</li>}
					</ul>
				</CardContent>
			</Card>
		</main>
	);
}
