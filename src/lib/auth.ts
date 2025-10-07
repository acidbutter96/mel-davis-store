"use server";
import { ObjectId } from "mongodb";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createPersistentSession, revokeSessionByJwt } from "@/lib/session";

// Async wrappers to avoid non-async exports in a "use server" file
export async function auth() {
	const mod = await import("@/lib/session");
	return mod.auth();
}
export async function decrypt(token: string) {
	const mod = await import("@/lib/session");
	return mod.decrypt(token);
}
export async function updateSession(request: Request) {
	const mod = await import("@/lib/session");
	// Loose typing for compatibility; middleware uses NextRequest.
	// @ts-ignore
	return mod.updateSession(request);
}

// Login Server Action authenticates against MongoDB
export async function login(_state: unknown, formData: FormData): Promise<{ error?: string } | undefined> {
	"use server";
	const emailRaw = formData.get("email");
	const passwordRaw = formData.get("password");
	if (typeof emailRaw !== "string" || typeof passwordRaw !== "string") {
		return { error: "Invalid data" };
	}
	const email = emailRaw.toLowerCase();
	const password = passwordRaw;
	try {
		// Dynamic imports avoid bundling mongodb/bcrypt into the edge (middleware) bundle
		const [{ getDb }, bcryptjs] = await Promise.all([import("@/lib/mongodb"), import("bcryptjs")]);
		const bcrypt = (bcryptjs as typeof import("bcryptjs")).default;
		const db = await getDb();
		const user = await db
			.collection("users")
			.findOne<{ _id: unknown; email: string; passwordHash?: string; name?: string }>(
				{ email },
				{ projection: { email: 1, passwordHash: 1, name: 1 } },
			);
		if (!user || !user.passwordHash) return { error: "Invalid credentials" };
		const ok = await bcrypt.compare(password, user.passwordHash);
		if (!ok) return { error: "Invalid credentials" };
		const cartRaw = formData.get("cart");
		let overrideApplied = false;
		if (typeof cartRaw === "string" && cartRaw.trim()) {
			try {
				const parsed = JSON.parse(cartRaw) as {
					items?: { productId: string; variantId: string; quantity: number }[];
				};
				if (parsed.items && Array.isArray(parsed.items) && parsed.items.length > 0) {
					const map = new Map<string, { productId: string; variantId: string; quantity: number }>();
					for (const it of parsed.items) {
						if (!it || typeof it !== "object") continue;
						if (!it.variantId || !it.productId) continue;
						if (typeof it.quantity !== "number" || it.quantity <= 0) continue;
						const ex = map.get(it.variantId);
						if (ex) ex.quantity += it.quantity;
						else
							map.set(it.variantId, {
								productId: it.productId,
								variantId: it.variantId,
								quantity: it.quantity,
							});
					}
					const minimal = Array.from(map.values()).filter((i) => i.quantity > 0);
					if (minimal.length > 0) {
						await db
							.collection("users")
							.updateOne(
								{ _id: new ObjectId(String(user._id)) },
								{ $set: { cart: { items: minimal }, updatedAt: new Date() } },
							);
						try {
							const [{ getCartId, clearCartId }, { commerce }] = await Promise.all([
								import("@/lib/cart-cookies"),
								import("@/lib/commerce-stripe"),
							]);
							const guestId = await getCartId();
							if (guestId) {
								try {
									await commerce.cart.clear({ cartId: guestId });
								} catch {}
								await clearCartId();
							}
						} catch {}
						overrideApplied = true;
						console.debug("[login] cart override applied", minimal.length);
					}
				} else {
					console.debug("[login] no valid cart items to override");
				}
			} catch (e) {
				console.warn("[login] failed to parse cart payload", e);
			}
		}
		if (!overrideApplied) {
			console.debug("[login] no cart override");
		}
		await createPersistentSession({ id: String(user._id), email: user.email, name: user.name });
		redirect("/");
	} catch (err: unknown) {
		if (
			err &&
			typeof err === "object" &&
			"digest" in err &&
			typeof (err as { digest?: unknown }).digest === "string" &&
			String((err as { digest: string }).digest).startsWith("NEXT_REDIRECT")
		) {
			throw err;
		}
		console.error("[login action]", err);
		return { error: "Authentication error" };
	}
}

export async function logout() {
	"use server";
	const ck = (await cookies()).get("session")?.value;
	if (ck) await revokeSessionByJwt(ck);
	(await cookies()).delete("session");
	redirect("/login");
}
