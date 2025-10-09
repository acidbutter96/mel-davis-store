import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { Card, CardContent, CardHeader, CardTitle } from "@/ui/shadcn/card";

export default async function AdminUsersPage() {
	const session = await auth();
	if (!session) redirect("/login");
	if (session.user.role !== "admin") redirect("/forbidden");

	const db = await getDb();
	interface UserLite {
		_id: unknown;
		email: string;
		name?: string;
	}
	const users = (await db
		.collection("users")
		.find({}, { projection: { passwordHash: 0 } })
		.sort({ createdAt: -1 })
		.limit(50)
		.toArray()) as unknown as UserLite[];

	return (
		<main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
			<div className="flex items-center justify-between">
				<h1 className="text-2xl font-semibold">Users</h1>
			</div>
			<Card>
				<CardHeader>
					<CardTitle>Latest users</CardTitle>
				</CardHeader>
				<CardContent>
					<ul className="divide-y">
						{users.map((u: UserLite) => (
							<li key={String(u._id)} className="py-3 flex items-center justify-between gap-3">
								<div>
									<div className="font-medium break-all sm:break-normal">{u.email}</div>
									<div className="text-sm text-muted-foreground">{u.name || "—"}</div>
								</div>
								<Link className="text-sm underline" href={`/admin/users/${String(u._id)}`}>
									Details
								</Link>
							</li>
						))}
						{users.length === 0 && <li className="py-6 text-muted-foreground">No users.</li>}
					</ul>
				</CardContent>
			</Card>
		</main>
	);
}
