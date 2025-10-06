"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { finalizeCheckoutCleanup, recordSuccessfulCheckout } from "@/actions/order-actions";
import { useCart } from "@/context/cart-context";

type CheckoutStatus =
	| "success"
	| "processing"
	| "requires_payment_method"
	| "failed"
	| "open"
	| "expired"
	| "cancel"
	| "missing_session"
	| "stripe_not_configured"
	| "error"
	| "unknown";

const successLikeStatuses: CheckoutStatus[] = ["success", "processing"];

export function CheckoutSuccessHandler() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const { closeCart } = useCart();
	const [ran, setRan] = useState(false);

	useEffect(() => {
		const statusParam = searchParams.get("checkout");
		const sessionId = searchParams.get("session_id");
		if (ran || !statusParam) return;
		setRan(true);
		const status = normalizeStatus(statusParam);
		const message = statusMessages[status];
		(async () => {
			try {
				if (successLikeStatuses.includes(status)) {
					const res = await finalizeCheckoutCleanup();
					if ("ok" in res) {
						closeCart();
						if (sessionId) {
							try {
								await recordSuccessfulCheckout(sessionId);
							} catch (e) {
								console.warn("Failed to record purchase locally", e);
							}
						}
					}
				}
				showToast(message);
			} catch (e) {
				console.error("Failed to cleanup after checkout", e);
				showToast(statusMessages.error);
			} finally {
				// Remove the query parameters from the URL
				const sp = new URLSearchParams(Array.from(searchParams.entries()));
				sp.delete("checkout");
				sp.delete("session_id");
				const newQs = sp.toString();
				router.replace(newQs ? `/?${newQs}` : "/");
			}
		})();
	}, [searchParams, router, ran, closeCart]);

	return null;
}

function normalizeStatus(raw: string): CheckoutStatus {
	const value = raw.toLowerCase();
	switch (value) {
		case "success":
		case "processing":
		case "requires_payment_method":
		case "failed":
		case "open":
		case "expired":
		case "cancel":
		case "missing_session":
		case "stripe_not_configured":
		case "error":
		case "unknown":
			return value;
		default:
			return "unknown";
	}
}

const statusMessages: Record<
	CheckoutStatus | "error",
	{ type: "success" | "error" | "info" | "warning"; title: string; description?: string }
> = {
	success: {
		type: "success",
		title: "Payment confirmed",
		description: "Thank you for your purchase!",
	},
	processing: {
		type: "info",
		title: "Payment processing",
		description: "We'll update your order status as soon as the bank confirms.",
	},
	requires_payment_method: {
		type: "error",
		title: "Payment not authorized",
		description: "Review your payment details or try another method.",
	},
	failed: {
		type: "error",
		title: "Payment not completed",
		description: "No charges were made and the cart is still available.",
	},
	open: {
		type: "info",
		title: "Checkout still open",
		description: "Complete the payment to finish your order.",
	},
	expired: {
		type: "warning",
		title: "Session expired",
		description: "Restart the checkout to try again.",
	},
	cancel: {
		type: "warning",
		title: "Checkout canceled",
		description: "Your items remain in the cart if you'd like to try again.",
	},
	missing_session: {
		type: "error",
		title: "Checkout session not found",
		description: "Try starting a new checkout.",
	},
	stripe_not_configured: {
		type: "error",
		title: "Stripe not configured",
		description: "Check the server environment variables.",
	},
	error: {
		type: "error",
		title: "Error validating payment",
		description: "Try again or contact support if it persists.",
	},
	unknown: {
		type: "info",
		title: "Unknown checkout status",
		description: "We're looking into it. Please try again if needed.",
	},
};

function showToast(message: {
	type: "success" | "error" | "info" | "warning";
	title: string;
	description?: string;
}) {
	switch (message.type) {
		case "success":
			toast.success(message.title, { description: message.description });
			break;
		case "error":
			toast.error(message.title, { description: message.description });
			break;
		case "warning":
			toast.warning(message.title, { description: message.description });
			break;
		case "info":
		default:
			toast(message.title, { description: message.description });
	}
}
