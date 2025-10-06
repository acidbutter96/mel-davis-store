import { ObjectId } from "mongodb";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { auth, logout } from "@/lib/auth";
import { getDb } from "@/lib/mongodb";
import { ProfileEditor } from "@/ui/profile-editor.client";

export const dynamic = "force-dynamic"; // ensures cookie revalidation

export default async function UserPage(props: {
	searchParams: Promise<{ section?: string }> | { section?: string };
}) {
	const resolvedSearchParams = "then" in props.searchParams ? await props.searchParams : props.searchParams;
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
							<div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
								{purchases.map((p) => {
									const statusLower = p.status.toLowerCase();
									const statusStyle: Record<string, string> = {
										paid: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
										succeeded:
											"bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
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
									const badgeCls = statusStyle[statusLower] || statusStyle.default;
									return (
										<div
											key={p.id}
											className="group relative overflow-hidden rounded-xl border bg-gradient-to-br from-background to-background/40 p-5 shadow-sm ring-1 ring-transparent transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg hover:ring-primary/20"
										>
											<div className="flex items-start justify-between gap-3">
												<div className="min-w-0 space-y-1">
													<p className="truncate text-xs font-mono text-muted-foreground/70">{p.id}</p>
													<p className="text-sm font-semibold tracking-tight">
														{(p.amountTotal / 100).toLocaleString(undefined, {
															style: "currency",
															currency: p.currency,
														})}
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
												<div>{new Date(p.createdAt).toLocaleString()}</div>
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
										</div>
									);
								})}
							</div>
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
