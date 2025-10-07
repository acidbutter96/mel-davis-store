import { ObjectId } from "mongodb";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth, logout } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ProfileEditor } from "@/ui/profile-editor.client";
import { PurchasesGrid } from "@/ui/purchases-grid.client";

export const dynamic = "force-dynamic"; // ensures cookie revalidation

type UserPageSearchParams = { section?: string };

export default async function UserPage({
	searchParams,
}: {
	searchParams?: Promise<UserPageSearchParams>;
}) {
	const resolvedSearchParams = (searchParams ? await searchParams : {}) as UserPageSearchParams;
	const session = await auth();
	if (!session) return redirect("/login");
	const { user } = session;
	const section = (resolvedSearchParams.section || "overview") as "overview" | "profile" | "purchases";

	interface FullUserDoc {
		_id: ObjectId;
		email: string;
		name?: string;
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
	let fullUser: FullUserDoc | null = null;
	if (section === "profile") {
		try {
			const db = await getDb();
			fullUser = await db
				.collection<FullUserDoc>("users")
				.findOne({ _id: new ObjectId(user.id) }, { projection: { passwordHash: 0 } });
		} catch (e) {
			console.error("[user/page] Failed to load full user data", e);
		}
	}

	let purchases: Array<{
		id: string;
		createdAt: Date;
		status: string;
		amountTotal: number;
		currency: string;
		items: Array<{
			name?: string | null;
			quantity: number;
			unitAmount?: number | null;
			priceId?: string | null;
		}>;
	}> | null = null;
	if (section === "purchases") {
		try {
			const db = await getDb();
			const userDoc = await db
				.collection("users")
				.findOne<{ purchases?: typeof purchases }>(
					{ _id: new ObjectId(user.id) },
					{ projection: { purchases: 1 } },
				);
			purchases = (userDoc?.purchases || []).slice().reverse();
		} catch (e) {
			console.error("[user/page] load purchases error", e);
		}
	}

	function renderContent() {
		switch (section) {
			case "profile": {
				const initial = {
					_id: user.id,
					name: fullUser?.name ?? user.name,
					email: fullUser?.email ?? user.email,
					phone: fullUser?.phone,
					address: fullUser?.address,
				};
				return <ProfileEditor userId={user.id} initial={initial} />;
			}
			case "purchases": {
				return (
					<div className="space-y-6">
						<div className="flex items-center justify-between gap-4 flex-wrap">
							<h2 className="text-2xl font-semibold tracking-tight">Purchases</h2>
						</div>
						{!purchases || purchases.length === 0 ? (
							<div className="rounded-lg border border-dashed p-10 text-center">
								<p className="text-sm text-muted-foreground">
									No purchases yet. Complete a checkout to see it here.
								</p>
							</div>
						) : (
							<PurchasesGrid purchases={purchases} />
						)}
					</div>
				);
			}
			case "overview":
			default:
				return (
					<div className="space-y-4">
						<h2 className="text-xl font-semibold">Overview</h2>
						<p className="text-sm text-muted-foreground">
							Quick summary of your account (TODO: real metrics).
						</p>
					</div>
				);
		}
	}

	const navItems: { key: typeof section; label: string }[] = [
		{ key: "overview", label: "Overview" },
		{ key: "profile", label: "Profile" },
		{ key: "purchases", label: "Purchases" },
	];

	return (
		<div className="max-w-7xl mx-auto py-10 px-4 grid gap-8 grid-cols-[14rem_1fr] min-h-screen">
			{/* Sidebar */}
			<aside className="w-56 shrink-0 space-y-6 sticky top-20 self-start h-max">
				<div className="space-y-1">
					<h1 className="text-xl font-bold">My Account</h1>
					<p className="text-xs text-muted-foreground">Session expires in 5h</p>
				</div>
				<nav className="flex flex-col gap-1" aria-label="Account navigation">
					{navItems.map((item) => {
						const active = item.key === section;
						return (
							<Link
								key={item.key}
								href={`/user?section=${item.key}`}
								aria-current={active ? "page" : undefined}
								className={`rounded-md px-3 py-2 text-sm font-medium border transition-colors hover:bg-accent hover:text-accent-foreground ${active ? "bg-accent border-accent" : "border-transparent"}`}
							>
								{item.label}
							</Link>
						);
					})}
				</nav>
				<div className="pt-4 space-y-2">
					<Link
						href="/"
						className="inline-flex w-full justify-center rounded-md border px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground"
					>
						← Back to Home
					</Link>
					<form action={logout}>
						<Button variant="outline" className="w-full" type="submit">
							Sign out
						</Button>
					</form>
				</div>
			</aside>

			{/* Main content */}
			<main className="w-200 space-y-8">{renderContent()}</main>
		</div>
	);
}
