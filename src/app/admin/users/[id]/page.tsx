import { ObjectId } from "mongodb";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";

function isValidObjectId(id: string | undefined | null): id is string {
	return !!id && /^[0-9a-fA-F]{24}$/.test(id);
}

export default async function AdminUserDetails({ params }: { params: { id: string } }) {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	const id = params?.id;
	if (!isValidObjectId(id)) redirect("/admin/users");

	const db = await getDb();
	const user = await db
		.collection("users")
		.findOne({ _id: new ObjectId(id) }, { projection: { passwordHash: 0 } });
	if (!user) redirect("/admin/users");

	return (
		<main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
			<div>
				<h1 className="text-2xl font-semibold">User details</h1>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Profile</CardTitle>
				</CardHeader>
				<CardContent className="space-y-1">
					<div>
						<span className="text-muted-foreground">Email:</span> {user.email}
					</div>
					{user.name && (
						<div>
							<span className="text-muted-foreground">Name:</span> {user.name}
						</div>
					)}
					{user.phone && (
						<div>
							<span className="text-muted-foreground">Phone:</span> {user.phone}
						</div>
					)}
					{user.address && (
						<div className="text-sm text-muted-foreground">
							Address:{" "}
							{[
								user.address.line1,
								user.address.city,
								user.address.state,
								user.address.postalCode,
								user.address.country,
							]
								.filter(Boolean)
								.join(", ")}
						</div>
					)}
				</CardContent>
			</Card>
			<Card>
				<CardHeader>
					<CardTitle>Purchases</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="divide-y">
						{(user.purchases || []).map((p: { id: string; status: string; createdAt: string | Date }) => (
							<li key={p.id} className="py-3 flex items-center justify-between">
								<div>
									<div className="font-medium capitalize">{p.status}</div>
									<div className="text-sm text-muted-foreground">
										{new Date(p.createdAt).toLocaleString()}
									</div>
								</div>
								<div className="text-sm font-mono">{p.id}</div>
							</li>
						))}
						{(!user.purchases || user.purchases.length === 0) && (
							<li className="py-6 text-muted-foreground">No purchases.</li>
						)}
					</ul>
				</CardContent>
			</Card>
		</main>
	);
}
