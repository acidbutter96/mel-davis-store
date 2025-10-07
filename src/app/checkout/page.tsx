import { redirect } from "next/navigation";
import { mergeGuestCartIntoUser } from "@/actions/cart-actions";
import { createCheckoutSession } from "@/actions/checkout-actions";

/**
 * Server page that:
 * 1. Attempts to merge a guest cart into the user (if just signed up / logged in)
 * 2. Creates a Stripe Checkout session from the (now user) cart
 * 3. Redirects the user directly to Stripe
 * If not authenticated, user is sent to home with checkout=cancel or requireAuth flag.
 */
export default async function CheckoutStartPage() {
	// Ensure any guest cart is merged after auth
	await mergeGuestCartIntoUser().catch(() => {});

	const res = await createCheckoutSession();
	if ("url" in res) {
		redirect(res.url);
	}
	if ("requireAuth" in res) {
		redirect("/?checkout=cancel");
	}
	// Fallback: show error and a link back
	return (
		<main className="mx-auto max-w-md py-12">
			<h1 className="mb-4 text-2xl font-bold">Checkout error</h1>
			{"error" in res ? (
				<p className="text-sm text-red-600">{res.error}</p>
			) : (
				<p className="text-sm text-red-600">Unknown cart state</p>
			)}
			<a className="mt-6 inline-block text-blue-600 underline" href="/products">
				Continue shopping
			</a>
		</main>
	);
}
