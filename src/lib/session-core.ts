import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import { env } from "@/env.mjs";

if (!env.JWT_SECRET) throw new Error("JWT_SECRET must be defined");

const key = new TextEncoder().encode(env.JWT_SECRET);

export interface CoreSessionData extends JWTPayload {
	user: { id: string; email: string; name?: string };
	expires: number;
}

export async function coreEncrypt(payload: CoreSessionData): Promise<string> {
	const expSeconds = Math.floor(payload.expires / 1000);
	return await new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256" })
		.setIssuedAt()
		.setExpirationTime(expSeconds)
		.sign(key);
}

export async function coreDecrypt(token: string): Promise<CoreSessionData | null> {
	try {
		const r = await jwtVerify(token, key, { algorithms: ["HS256"] });
		return r.payload as CoreSessionData;
	} catch {
		return null;
	}
}

export function generateSid(): string {
	if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
		const buf = new Uint8Array(16);
		crypto.getRandomValues(buf);
		return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
	}
	// fallback (Node) - dynamic require avoided in edge import path
	const nodeCrypto = require("crypto") as typeof import("crypto");
	return nodeCrypto.randomBytes(16).toString("hex");
}
