import type { UpdateFilter } from "mongodb";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/api-auth";
import { getDb } from "@/lib/mongodb";

type HistoryEntry = { date: string; userId: string; changes: Record<string, unknown> };
type SettingsDoc = {
	_id?: unknown;
	current: {
		theme?: "light" | "dark";
		// add other settings here as they grow
	};
	history: Array<HistoryEntry>;
};

export async function GET() {
	const { error } = await requireAdmin();
	if (error) return error;
	const db = await getDb();
	const doc = await db.collection<SettingsDoc>("settings").findOne({});
	return NextResponse.json(doc ?? { current: {}, history: [] });
}

export async function PATCH(req: Request) {
	const { session, error } = await requireAdmin();
	if (error) return error;
	const db = await getDb();
	const body = (await req.json()) as Partial<SettingsDoc["current"]>;

	const now = new Date().toISOString();
	const userId = session!.sub as string;

	// Upsert single settings document; push history entry
	const update: UpdateFilter<SettingsDoc> = {
		$set: Object.fromEntries(Object.entries(body).map(([k, v]) => [`current.${k}`, v])),
		$push: { history: { date: now, userId, changes: body as Record<string, unknown> } as HistoryEntry },
	};

	await db.collection<SettingsDoc>("settings").updateOne({}, update, { upsert: true });
	const latest = await db.collection<SettingsDoc>("settings").findOne({});
	return NextResponse.json(
		latest ?? { current: body, history: [{ date: now, userId, changes: body as Record<string, unknown> }] },
	);
}
