"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { encrypt, SessionDuration } from "@/lib/session";

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
		const expires = Date.now() + SessionDuration;
		const session = await encrypt({
			user: { id: String(user._id), email: user.email, name: user.name },
			expires,
		});
		(await cookies()).set("session", session, {
			expires: new Date(expires),
			httpOnly: true,
			secure: process.env.NODE_ENV === "production",
			sameSite: "lax",
			path: "/",
		});
		redirect("/user");
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
	(await cookies()).delete("session");
	redirect("/login");
}
