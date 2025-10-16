import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import { createPersistentSession } from "@/lib/session";

const schema = z.object({ token: z.string().min(16) });

export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const token = url.searchParams.get("token") || "";
		const { token: t } = schema.parse({ token });
		const db = await getDb();
		const now = new Date();
		const res = await db
			.collection("users")
			.findOneAndUpdate(
				{ "verification.token": t, "verification.expiresAt": { $gt: now } },
				{ $set: { verified: true }, $unset: { verification: "" } },
				{ returnDocument: "after", projection: { _id: 1, email: 1 } },
			);
		if (!res || !res.value) return new Response("Invalid or expired token", { status: 400 });
		const user = res.value as { _id: { toString: () => string }; email: string };
		const userId =
			typeof user._id === "object" && typeof user._id.toString === "function"
				? user._id.toString()
				: String(user._id);
		await createPersistentSession({ id: userId, email: user.email, name: undefined, role: "customer" });
		return new Response(null, { status: 302, headers: { Location: "/checkout" } });
	} catch {
		return new Response("Invalid request", { status: 400 });
	}
}
