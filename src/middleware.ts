import { jwtVerify } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { env } from "@/env.mjs";
import { coreDecrypt } from "@/lib/session-core";

async function verifyAuth(request: NextRequest) {
	const auth = request.headers.get("authorization") || request.headers.get("Authorization");
	if (auth?.startsWith("Bearer ")) {
		const token = auth.slice(7).trim();
		try {
			const secret = new TextEncoder().encode(env.JWT_SECRET);
			await jwtVerify(token, secret, { algorithms: ["HS256"] });
			return true;
		} catch {
			/* ignore */
		}
	}
	const session = request.cookies.get("session")?.value;
	if (session) {
		const data = await coreDecrypt(session);
		if (data && data.expires > Date.now()) return true;
	}
	return false;
}

export async function middleware(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const isApi = pathname.startsWith("/api");
	const isAuthPublic = pathname === "/api/auth/login" || pathname === "/api/auth/register";
	const pageProtected = pathname.startsWith("/orders") || pathname.startsWith("/user");
	const isAdmin = pathname.startsWith("/admin");

	if (isApi && !isAuthPublic) {
		const ok = await verifyAuth(request);
		if (!ok) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
		return NextResponse.next();
	}

	if (pageProtected) {
		const ok = await verifyAuth(request);
		if (!ok) return NextResponse.redirect(new URL("/login", request.url));
		return NextResponse.next();
	}
	if (isAdmin) {
		const session = request.cookies.get("session")?.value;
		if (!session) return NextResponse.redirect(new URL("/login", request.url));
		const data = await coreDecrypt(session);
		if (!data || data.expires <= Date.now()) return NextResponse.redirect(new URL("/login", request.url));
		if (data.user.role !== "admin") return NextResponse.redirect(new URL("/forbidden", request.url));
		return NextResponse.next();
	}
	return NextResponse.next();
}

export const config = {
	matcher: ["/api/:path*", "/orders/:path*", "/user/:path*", "/admin/:path*"],
};
