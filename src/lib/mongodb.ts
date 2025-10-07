import { type Db, MongoClient } from "mongodb";
import { env } from "@/env.mjs";

// Reuse connection in development to avoid creating multiple connections during HMR
interface GlobalMongoCache {
	client: MongoClient | null;
	promise: Promise<MongoClient> | null;
}

// @ts-ignore
const globalForMongo: { _mongo?: GlobalMongoCache } = globalThis;

const mongoCache: GlobalMongoCache = globalForMongo._mongo ?? {
	client: null,
	promise: null,
};

if (!globalForMongo._mongo) {
	globalForMongo._mongo = mongoCache;
}

async function connectWithRetry(uri: string, attempts = 2, delayMs = 400): Promise<MongoClient> {
	let lastErr: unknown;
	for (let i = 0; i < attempts; i++) {
		try {
			return await MongoClient.connect(uri, {
				serverSelectionTimeoutMS: 4000,
			});
		} catch (err) {
			lastErr = err;
			if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs * (i + 1)));
		}
	}
	throw lastErr;
}

export async function getMongoClient() {
	if (mongoCache.client) return mongoCache.client;
	if (!mongoCache.promise) {
		if (!env.MONGODB_URI) throw new Error("Missing MONGODB_URI env variable");

		const uri = env.MONGODB_URI.trim();

		const looksLikeAtlasButWrongHost = uri.includes("mongodb.net") && /mongodb:\/\/mongo[:/]/.test(uri);
		if (looksLikeAtlasButWrongHost) {
			throw new Error(
				"Detectado host 'mongo' em URI aparentemente do Atlas. Copie a URI completa do Atlas (mongodb+srv://...) e substitua em MONGODB_URI.",
			);
		}

		const isSrv = uri.startsWith("mongodb+srv://");
		const isLocalDockerHost = !isSrv && /mongodb:\/\/mongo(?::|\/)/.test(uri);

		mongoCache.promise = (async () => {
			const attempted: string[] = [];

			async function tryUri(current: string) {
				attempted.push(current);
				return await connectWithRetry(current);
			}

			let primaryError: unknown = null;
			try {
				return await tryUri(uri);
			} catch (err: unknown) {
				primaryError = err;
				const errObj = err as { message?: string; cause?: { message?: string } };
				const msg = String(errObj?.message || "");
				const dnsFailure =
					/EAI_AGAIN|ENOTFOUND|getaddrinfo/.test(msg) || /EAI_AGAIN/.test(String(errObj?.cause?.message));
				if (isLocalDockerHost && dnsFailure) {
					const localhostUri = uri.replace(/mongodb:\/\/mongo/, "mongodb://localhost");
					console.warn(`[Mongo] Host 'mongo' unreachable (DNS). Trying fallback: ${localhostUri}`);
					try {
						return await tryUri(localhostUri);
					} catch (err2: unknown) {
						const atlas = process.env.MONGODB_ATLAS_URI;
						if (atlas) {
							console.warn("[Mongo] Fallback localhost failed. Trying MONGODB_ATLAS_URI (Atlas).");
							try {
								return await tryUri(atlas);
							} catch (err3: unknown) {
								throw buildEnhancedError([primaryError, err2, err3], attempted);
							}
						}
						throw buildEnhancedError([primaryError, err2], attempted);
					}
				}
				throw enhanceIfAtlasMismatch(
					err instanceof Error
						? err
						: new Error(String((err as { message?: string })?.message || "Unknown error")),
					uri,
				);
			}
		})();
	}
	mongoCache.client = await mongoCache.promise;
	return mongoCache.client;
}

function enhanceIfAtlasMismatch(err: Error, uri: string) {
	if (/mongodb\.net/.test(uri) && !uri.startsWith("mongodb+srv://")) {
		err.message +=
			"\n[Hint] Atlas URIs usually use the format mongodb+srv://. Check the string copied from the Atlas dashboard.";
	}
	return err;
}

function buildEnhancedError(errors: unknown[], attempted: string[]) {
	const e = new Error(
		`Could not connect to MongoDB after fallbacks. Attempts: ${attempted.join(", ")}. Last error: ${String((errors[errors.length - 1] as { message?: string })?.message)}`,
	);
	(e as unknown as { causes: Array<{ message: string | undefined; stack: string | undefined }> }).causes =
		errors.map((x) => {
			const errX = x as { message?: string; stack?: string };
			return { message: errX.message, stack: errX.stack };
		});
	return e;
}

export async function getDb(): Promise<Db> {
	const client = await getMongoClient();
	const dbName = env.MONGODB_DB_NAME;
	return client.db(dbName);
}

let indexesEnsured = false;
export async function ensureIndexes() {
	if (indexesEnsured) return;
	const db = await getDb();
	await db.collection("users").createIndex({ email: 1 }, { unique: true });
	const sessions = db.collection("sessions");
	try {
		await sessions.createIndex({ userId: 1, jwt: 1 });
	} catch {}
	try {
		await sessions.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	} catch {}

	await sessions.updateMany({ expiresAt: { $exists: false }, expires: { $gt: 0 } }, [
		{ $set: { expiresAt: { $toDate: "$expires" } } },
	]);
	indexesEnsured = true;
}

export type WithId<T> = T & { _id: string };

export type UserCartItem = { productId: string; variantId: string; quantity: number };

export interface UserCart {
	items: Array<UserCartItem>;
}

export interface UserDoc {
	_id?: string;
	email: string;
	name?: string;
	phone?: string;
	address?: {
		line1?: string;
		line2?: string;
		city?: string;
		state?: string;
		postalCode?: string;
		country?: string;
	};
	passwordHash?: string; // password hash
	cart?: UserCart;
	purchases?: Array<{
		id: string;
		createdAt: Date;
		status: string; // e.g. paid, open, incomplete
		amountTotal: number;
		currency: string;
		items: Array<{
			priceId?: string | null;
			productId?: string | null;
			name?: string | null;
			quantity: number;
			unitAmount?: number | null;
		}>;
		invoiceId?: string | null;
		paymentIntentId?: string | null;
		cart?: UserCart | null;
	}>;
	createdAt: Date;
	updatedAt: Date;
}
