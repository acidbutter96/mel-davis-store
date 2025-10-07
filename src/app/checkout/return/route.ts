import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import Stripe from "stripe";
import { env, publicUrl } from "@/env.mjs";

const stripe = env.STRIPE_SECRET_KEY ? new Stripe(env.STRIPE_SECRET_KEY, { apiVersion: undefined }) : null;

type CheckoutStatus =
	| "success"
	| "processing"
	| "requires_payment_method"
	| "open"
	| "expired"
	| "failed"
	| "cancel"
	| "unknown";

const REDIRECT_PARAM = "checkout";

export async function GET(req: NextRequest) {
	const sessionId = req.nextUrl.searchParams.get("session_id");
	const cancel = req.nextUrl.searchParams.get("cancel");
	const redirectBase = publicUrl.replace(/\/$/, "");

	if (cancel) {
		return NextResponse.redirect(
			buildRedirectUrl(redirectBase, {
				[REDIRECT_PARAM]: "cancel",
			}),
		);
	}

	if (!sessionId) {
		return NextResponse.redirect(
			buildRedirectUrl(redirectBase, {
				[REDIRECT_PARAM]: "missing_session",
			}),
		);
	}

	if (!stripe) {
		return NextResponse.redirect(
			buildRedirectUrl(redirectBase, {
				[REDIRECT_PARAM]: "stripe_not_configured",
				session_id: sessionId,
			}),
		);
	}

	try {
		const session = await stripe.checkout.sessions.retrieve(sessionId, {
			expand: ["payment_intent"],
		});

		const status = deriveCheckoutStatus(session);

		console.log(session);

		return NextResponse.redirect(
			buildRedirectUrl(redirectBase, {
				[REDIRECT_PARAM]: status,
				session_id: sessionId,
			}),
		);
	} catch (error) {
		console.error("[checkout/return] Failed to retrieve session", error);
		return NextResponse.redirect(
			buildRedirectUrl(redirectBase, {
				[REDIRECT_PARAM]: "error",
				session_id: sessionId,
			}),
		);
	}
}

function deriveCheckoutStatus(session: Stripe.Checkout.Session): CheckoutStatus {
	const paymentStatus = session.payment_status;
	const sessionStatus = session.status;
	const paymentIntent =
		typeof session.payment_intent === "object" ? (session.payment_intent as Stripe.PaymentIntent) : undefined;

	if (
		paymentStatus === "paid" ||
		paymentStatus === "no_payment_required" ||
		paymentIntent?.status === "succeeded"
	) {
		return "success";
	}

	if (paymentIntent?.status === "processing") {
		return "processing";
	}

	if (
		paymentIntent?.status === "requires_payment_method" ||
		paymentIntent?.status === "requires_action" ||
		paymentIntent?.status === "requires_confirmation" ||
		paymentIntent?.status === "requires_capture"
	) {
		return "requires_payment_method";
	}

	if (sessionStatus === "expired") {
		return "expired";
	}

	if (sessionStatus === "open") {
		return "open";
	}

	if (sessionStatus === "complete" && paymentStatus === "unpaid") {
		return "failed";
	}

	return "unknown";
}

function buildRedirectUrl(base: string, params: Record<string, string | undefined>) {
	const searchParams = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value) searchParams.set(key, value);
	}

	const qs = searchParams.toString();
	return qs ? `${base}/?${qs}` : `${base}/`;
}
