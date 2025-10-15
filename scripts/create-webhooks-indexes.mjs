import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();
const uri = process.env.MONGODB_URI;
if (!uri) {
	console.error("MONGODB_URI not set");
	process.exit(1);
}
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
async function run() {
	try {
		await client.connect();
		const dbName = process.env.MONGODB_DB_NAME;
		if (!dbName) throw new Error("MONGODB_DB_NAME not set");
		const db = client.db(dbName);
		const webhooks = db.collection("webhooks");
		console.log("Creating index eventId (unique)");
		try {
			await webhooks.createIndex({ eventId: 1 }, { unique: true, sparse: true });
		} catch (e) {
			console.warn("eventId index create warning", e.message || e);
		}
		console.log("Creating index receivedAt (desc)");
		await webhooks.createIndex({ receivedAt: -1 });
		console.log("Indexes created");
	} finally {
		await client.close();
	}
}
run().catch((err) => {
	console.error(err);
	process.exit(1);
});
