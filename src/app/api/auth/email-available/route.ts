import { z } from "zod";
import { getDb } from "@/lib/mongodb";

const schema = z.object({ email: z.string().email() });

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as unknown;
		const { email } = schema.parse(body);
		const db = await getDb();
		const existing = await db
			.collection("users")
			.findOne({ email: email.toLowerCase() }, { projection: { _id: 1 } });
		return new Response(JSON.stringify({ available: !existing }), { status: 200 });
	} catch {
		return new Response(JSON.stringify({ error: "Invalid request" }), { status: 400 });
	}
}
