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
				// Ajusta tempo de seleção para falhar mais cedo e dar feedback
				serverSelectionTimeoutMS: 4000,
			});
		} catch (err) {
			lastErr = err;
			// Aguarda antes do próximo retry
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

		// Heuristic: user appears to use Atlas but left 'mongo' host by mistake
		const looksLikeAtlasButWrongHost = uri.includes("mongodb.net") && /mongodb:\/\/mongo[:/]/.test(uri);
		if (looksLikeAtlasButWrongHost) {
			throw new Error(
				"Detectado host 'mongo' em URI aparentemente do Atlas. Copie a URI completa do Atlas (mongodb+srv://...) e substitua em MONGODB_URI.",
			);
		}

		const isSrv = uri.startsWith("mongodb+srv://");
		const isLocalDockerHost = !isSrv && /mongodb:\/\/mongo(?::|\/)/.test(uri);

		mongoCache.promise = (async () => {
			// Cascade retry strategy:
			// 1. Original URI
			// 2. If host 'mongo' fails with DNS -> swap for localhost
			// 3. If still failing and MONGODB_ATLAS_URI exists, use it (keeps legacy MONGODB_URI)
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
						// Segunda falha — tentar Atlas se disponível
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
	indexesEnsured = true;
}

export type WithId<T> = T & { _id: string };

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
	createdAt: Date;
	updatedAt: Date;
}
