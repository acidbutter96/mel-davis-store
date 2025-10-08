import { jwtVerify } from "jose";
import { cookies, headers } from "next/headers";
import { env } from "@/env.mjs";
import { coreDecrypt } from "@/lib/session-core";

export async function requireAuth() {
	const h = await headers();
	const auth = h.get("authorization") || h.get("Authorization");
	if (auth?.startsWith("Bearer ")) {
		const token = auth.slice(7).trim();
		try {
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			const { payload } = await jwtVerify(token, secret, { algorithms: ["HS256"] });
			if (payload?.sub) return { session: payload };
		} catch {
			/* ignore */
		}
	}
	const sessionToken = (await cookies()).get("session")?.value;
	if (sessionToken) {
		const data = await coreDecrypt(sessionToken);
		if (data && data.expires > Date.now()) return { session: { sub: data.user.id, email: data.user.email } };
	}
	return { error: new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 }) };
}
