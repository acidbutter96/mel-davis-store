import { createCheckoutSession } from "@/actions/checkout-actions";

export async function POST() {
	const res = await createCheckoutSession();
	if ("requireAuth" in res) {
		return new Response(JSON.stringify({ requireAuth: true }), { status: 401 });
	}
	if ("error" in res) {
		return new Response(JSON.stringify({ error: res.error }), { status: 400 });
	}
	return Response.json(res);
}
