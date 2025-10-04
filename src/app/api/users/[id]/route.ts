import { ObjectId } from "mongodb";
import type { NextRequest } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/mongodb";
import bcrypt from "bcryptjs";

const updateUserSchema = z.object({
	name: z.string().min(1).optional(),
	password: z.string().min(6).optional(),
});

function isValidObjectId(id: string) {
	return /^[0-9a-fA-F]{24}$/.test(id);
}

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
	const { id } = params;
	if (!isValidObjectId(id)) {
		return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
	}
	const db = await getDb();
	const user = await db
		.collection("users")
		.findOne<{ _id: ObjectId; email: string; name?: string; createdAt: Date; updatedAt: Date }>(
			{ _id: new ObjectId(id) },
			{ projection: { passwordHash: 0 } },
		);
	if (!user) return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404 });
	return Response.json({ ...user, _id: user._id.toString() });
}

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
	const { id } = params;
	if (!isValidObjectId(id)) {
		return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
	}
	try {
		const body = await req.json();
		const data = updateUserSchema.parse(body);
		const db = await getDb();
		const now = new Date();
		const update: Record<string, unknown> = { updatedAt: now };
		if (data.name) update.name = data.name;
		if (data.password) update.passwordHash = await bcrypt.hash(data.password, 10);
		const result = await db
			.collection("users")
			.findOneAndUpdate(
				{ _id: new ObjectId(id) },
				{ $set: update },
				{ returnDocument: "after", projection: { passwordHash: 0 } },
			);
		if (!result.value)
			return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404 });
		return Response.json({ ...result.value, _id: result.value._id.toString() });
	} catch (err) {
		if (err instanceof z.ZodError) {
			return new Response(JSON.stringify({ error: err.flatten() }), { status: 400 });
		}
		console.error("[PUT /api/users/:id]", err);
		return new Response(JSON.stringify({ error: "Erro ao atualizar" }), { status: 500 });
	}
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
	const { id } = params;
	if (!isValidObjectId(id)) {
		return new Response(JSON.stringify({ error: "ID inválido" }), { status: 400 });
	}
	const db = await getDb();
	const res = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
	if (!res.deletedCount) return new Response(JSON.stringify({ error: "Não encontrado" }), { status: 404 });
	return new Response(null, { status: 204 });
}
