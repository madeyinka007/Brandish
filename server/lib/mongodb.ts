import { MongoClient, type Db } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

// Native MongoDB driver connection for the non-Mongoose collections (media, page_views,
// analytics, search_logs, audit_log, notifications — see docs/data-model.md's ODM split).
// Cached at module scope, same warm-Lambda rationale as lib/mongoose.ts.
const uri = process.env.MONGODB_URI!;
const options = { maxPoolSize: 10 }; // Atlas M0 max: 500 connections total

// Same Atlas database as the Mongoose connection (lib/mongoose.ts uses dbName 'wt-brandish').
// Both ODM paths must point at the same DB or native-driver collections land somewhere the
// Mongoose collections aren't.
const DB_NAME = 'wt-brandish';

let clientPromise: Promise<MongoClient>;

declare global {
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // In dev, reuse the cached client across hot-reloads.
  if (!global._mongoClientPromise) {
    global._mongoClientPromise = new MongoClient(uri, options).connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  // In production (Lambda), module scope is reused across warm invocations.
  clientPromise = new MongoClient(uri, options).connect();
}

export default clientPromise;

export async function getDb(dbName: string = DB_NAME): Promise<Db> {
  const client = await clientPromise;
  return client.db(dbName);
}
