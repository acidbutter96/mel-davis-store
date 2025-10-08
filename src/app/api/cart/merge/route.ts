import { NextResponse } from "next/server";
import { mergeGuestCartIntoUser } from "@/actions/cart-actions";
import { requireAuth } from "@/lib/api-auth";

/**
 * POST /api/cart/merge
 * Attempts to merge a guest cart (cookie-based) into the authenticated user cart.
 * Idempotent: if there is nothing to merge, returns { merged: false }.
 */
export async function POST() {
	const auth = await requireAuth();
	if ("error" in auth) {
		return NextResponse.json({ merged: false, reason: "unauthorized" }, { status: 401 });
	}
	try {
		const merged = await mergeGuestCartIntoUser();
		return NextResponse.json({ merged: !!merged, cart: merged || null });
	} catch (e) {
		console.error("[cart-merge] failed", e);
		return NextResponse.json({ merged: false, error: "merge_failed" }, { status: 500 });
	}
}
