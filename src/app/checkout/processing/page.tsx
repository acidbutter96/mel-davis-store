"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { finalizeCheckoutCleanup, recordSuccessfulCheckout } from "@/actions/order-actions";
import { useCart } from "@/context/cart-context";

export default function ProcessingPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const sessionId = searchParams.get("session_id");
	const [phase, setPhase] = useState<"processing" | "finalized" | "error">("processing");
	const { refreshCart, closeCart } = useCart();
	const ranRef = useRef(false);

	useEffect(() => {
		let redirectTimer: ReturnType<typeof setTimeout> | null = null;
		if (ranRef.current) return;
		ranRef.current = true;
		(async () => {
			if (sessionId?.startsWith("cs_")) {
				try {
					await recordSuccessfulCheckout(sessionId);
				} catch (e) {}
			}
			try {
				const res = await finalizeCheckoutCleanup();
				if ("ok" in res) {
					closeCart();
					setPhase("finalized");
					refreshCart().catch(() => {});
				} else {
					setPhase("error");
				}
			} catch (e) {
				setPhase("error");
			} finally {
				redirectTimer = setTimeout(() => {
					router.replace("/user?section=purchases");
				}, 1600);
			}
		})();

		return () => {
			if (redirectTimer) clearTimeout(redirectTimer);
		};
	}, [router, sessionId, refreshCart, closeCart]);

	const done = phase === "finalized";

	return (
		<main className="flex flex-col items-center justify-center py-24 px-6 text-center">
			<div className="max-w-md">
				<h1 className="text-2xl font-bold mb-4">
					{done ? "Order confirmed" : phase === "error" ? "Processing issue" : "Processing your order"}
				</h1>
				<p className="text-sm text-muted-foreground mb-8">
					{phase === "processing" && "We are finalizing your payment and preparing your order details."}
					{phase === "finalized" && "Payment captured and your order has been recorded."}
					{phase === "error" &&
						"We could not fully verify your payment now. You will see the latest status shortly."}
				</p>
				<div className="flex flex-col items-center">
					<div className="relative w-20 h-20 mb-6">
						{phase === "processing" && (
							<div className="absolute inset-0 animate-spin rounded-full border-4 border-muted border-t-primary" />
						)}
						<div
							className={`absolute inset-0 flex items-center justify-center transition-opacity ${done ? "opacity-100" : "opacity-0"}`}
						>
							<svg
								className="w-14 h-14 text-primary"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2"
								strokeLinecap="round"
								strokeLinejoin="round"
							>
								<path d="M20 6L9 17l-5-5" />
							</svg>
						</div>
						{phase === "error" && (
							<div className="absolute inset-0 flex items-center justify-center text-destructive">
								<svg
									className="w-12 h-12"
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth="2"
									strokeLinecap="round"
									strokeLinejoin="round"
								>
									<path d="M12 9v4" />
									<path d="M12 17h.01" />
									<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
								</svg>
							</div>
						)}
					</div>
					<p className="text-sm font-medium mb-2">
						{phase === "processing" && "Please wait..."}
						{phase === "finalized" && "Redirecting..."}
						{phase === "error" && "Redirecting..."}
					</p>
					<p className="text-xs text-muted-foreground">You will be redirected shortly.</p>
				</div>
			</div>
		</main>
	);
}
