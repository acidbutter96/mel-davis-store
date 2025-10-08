import { jwtVerify } from "jose";
import { cookies } from "next/headers";
import { env } from "@/env.mjs";
import { decrypt } from "@/lib/session";

export async function getUserIdFromAuthHeader(): Promise<string | null> {
	const h = await import("next/headers").then((m) => m.headers());
	const auth = (await h).get("authorization") || (await h).get("Authorization");
	if (!auth?.startsWith("Bearer ")) return null;
	const token = auth.slice(7).trim();
	try {
		const secret = new TextEncoder().encode(env.JWT_SECRET);
		const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
		if (payload && typeof payload.sub === "string") return payload.sub;
	} catch {}
	return null;
}

export async function getAuthenticatedUserId(): Promise<string | null> {
	let userId = await getUserIdFromAuthHeader();
	if (!userId) {
		const sessionToken = (await cookies()).get("session")?.value;
		if (sessionToken) {
			try {
				const data = await decrypt(sessionToken);
				if (data && data.expires > Date.now()) userId = data.user.id;
			} catch {}
		}
	}
	return userId;
}
