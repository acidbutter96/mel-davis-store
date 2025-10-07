"use client";
import { useEffect, useState } from "react";

/**
 * This lightweight client component attempts to trigger a guest cart merge
 * after the user authenticates. It calls an internal API route that invokes
 * the server action only when needed.
 */
export function CartMergeOnAuth() {
	const [done, setDone] = useState(false);
	useEffect(() => {
		if (done) return;
		(async () => {
			try {
				// Fire-and-forget; API will decide if merge is needed.
				await fetch("/api/cart/merge", { method: "POST", cache: "no-store" });
			} catch (e) {
				console.warn("Cart merge call failed", e);
			} finally {
				setDone(true);
			}
		})();
	}, [done]);
	return null;
}
