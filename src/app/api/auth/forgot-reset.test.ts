import { describe, expect, it } from "bun:test";
import bcrypt from "bcryptjs";
import { POST as forgotPOST } from "@/app/api/auth/forgot-password/route";
import { POST as resetPOST } from "@/app/api/auth/reset-password/route";
import { getDb } from "@/lib/mongodb";

describe("forgot/reset integration", () => {
	it("creates a token and resets the password", async () => {
		const db = await getDb();
		const users = db.collection("users");
		const email = `test+forgot-${Date.now()}@example.com`;
		// create test user
		const insert = await users.insertOne({ email, name: "Test User", passwordHash: "OLD_HASH" });
		const id = insert.insertedId;
		try {
			// Call forgot-password
			const req1 = new Request("http://localhost/api/auth/forgot-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ email }),
			});
			const res1 = await forgotPOST(req1 as unknown as Request);
			expect(res1).toBeTruthy();
			expect(res1.status).toBe(200);

			// Load user and check token
			const userAfter = await users.findOne({ _id: id });
			expect(userAfter).toBeTruthy();
			const token = userAfter!.passwordReset!.token;
			const expiresAt = userAfter!.passwordReset!.expiresAt;
			expect(typeof token).toBe("string");
			expect(token.length).toBeGreaterThanOrEqual(16);
			expect(expiresAt).toBeTruthy();

			// Call reset-password with a strong password
			const newPassword = "Str0ng!Passw0rd";
			const req2 = new Request("http://localhost/api/auth/reset-password", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token, password: newPassword }),
			});
			const res2 = await resetPOST(req2 as unknown as Request);
			expect(res2).toBeTruthy();
			expect(res2.status).toBe(200);

			const userFinal = await users.findOne({ _id: id });
			expect(userFinal).toBeTruthy();
			expect(userFinal!.passwordReset).toBeUndefined();
			// verify hashed password matches
			const ok = await bcrypt.compare(newPassword, userFinal!.passwordHash);
			expect(ok).toBeTruthy();
		} finally {
			// cleanup
			await users.deleteOne({ _id: id });
		}
	});
});
