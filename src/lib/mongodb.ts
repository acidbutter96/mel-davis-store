import { type Db, MongoClient } from "mongodb";
import { env } from "@/env.mjs";

// Reutiliza conexão em desenvolvimento para evitar criar múltiplas conexões em HMR
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

		// Heurística: se usuário está usando Atlas mas deixou 'mongo' por engano
		const looksLikeAtlasButWrongHost = uri.includes("mongodb.net") && /mongodb:\/\/mongo[:/]/.test(uri);
		if (looksLikeAtlasButWrongHost) {
			throw new Error(
				"Detectado host 'mongo' em URI aparentemente do Atlas. Copie a URI completa do Atlas (mongodb+srv://...) e substitua em MONGODB_URI.",
			);
		}

			const isSrv = uri.startsWith("mongodb+srv://");
			const isLocalDockerHost = !isSrv && /mongodb:\/\/mongo(?::|\/)/.test(uri);

			mongoCache.promise = (async () => {
				// Estratégia de tentativas em cascata:
				// 1. URI original
				// 2. Se host 'mongo' falhar com DNS -> trocar por localhost
				// 3. Se ainda falhar e existir MONGODB_ATLAS_URI usar essa (permite manter MONGODB_URI legado)
				const attempted: string[] = [];

				async function tryUri(current: string) {
					attempted.push(current);
					return await connectWithRetry(current);
				}

				let primaryError: any = null;
				try {
					return await tryUri(uri);
				} catch (err: any) {
					primaryError = err;
					const msg = String(err?.message || "");
					const dnsFailure = /EAI_AGAIN|ENOTFOUND|getaddrinfo/.test(msg) || /EAI_AGAIN/.test(String(err?.cause?.message));
					if (isLocalDockerHost && dnsFailure) {
						const localhostUri = uri.replace(/mongodb:\/\/mongo/, "mongodb://localhost");
						console.warn(
							`[Mongo] Host 'mongo' inalcançável (DNS). Tentando fallback: ${localhostUri}`,
						);
						try {
							return await tryUri(localhostUri);
						} catch (err2: any) {
							// Segunda falha — tentar Atlas se disponível
							const atlas = process.env.MONGODB_ATLAS_URI;
							if (atlas) {
								console.warn("[Mongo] Fallback localhost falhou. Tentando MONGODB_ATLAS_URI (Atlas)." );
								try {
									return await tryUri(atlas);
								} catch (err3) {
									throw buildEnhancedError([primaryError, err2, err3], attempted);
								}
							}
							throw buildEnhancedError([primaryError, err2], attempted);
						}
					}
					throw enhanceIfAtlasMismatch(err, uri);
				}
			})();
	}
	mongoCache.client = await mongoCache.promise;
	return mongoCache.client;
}

	function enhanceIfAtlasMismatch(err: any, uri: string) {
		if (/mongodb\.net/.test(uri) && !uri.startsWith("mongodb+srv://")) {
			err.message +=
				"\n[Hint] URI de Atlas geralmente usa o formato mongodb+srv://. Verifique a string copiada no painel Atlas.";
		}
		return err;
	}

	function buildEnhancedError(errors: any[], attempted: string[]) {
		const e = new Error(
			`Não foi possível conectar ao MongoDB após fallbacks. Tentativas: ${attempted.join(", ")}. Último erro: ${errors[errors.length - 1]?.message}`,
		);
		(e as any).causes = errors.map((x) => ({ message: x?.message, stack: x?.stack }));
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
	passwordHash?: string; // TODO: implementar hash de senha se necessário
	createdAt: Date;
	updatedAt: Date;
}
