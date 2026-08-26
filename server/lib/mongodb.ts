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

declare global {
  // TypeScript global augmentation requires `var` — `let`/`const` do not create a
  // property on globalThis.
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

// Cached connection attempt. Deliberately NOT created at module load — see lib/mongoose.ts:
// an import-time connect whose rejection has no handler attached kills the Lambda container
// (Runtime.UnhandledPromiseRejection) instead of failing the one request.
let clientPromise: Promise<MongoClient> | undefined;

function connect(): Promise<MongoClient> {
  const p = new MongoClient(uri, options).connect();
  // On failure, evict the cached attempt so the next request retries rather than reusing a
  // permanently-rejected promise for the life of the warm container.
  p.catch(() => {
    if (clientPromise === p) clientPromise = undefined;
    if (global._mongoClientPromise === p) global._mongoClientPromise = undefined;
  });
  return p;
}

export async function getClient(): Promise<MongoClient> {
  if (process.env.NODE_ENV === 'development') {
    // In dev, reuse the cached client across hot-reloads.
    if (!global._mongoClientPromise) global._mongoClientPromise = connect();
    return global._mongoClientPromise;
  }
  // In production (Lambda), module scope is reused across warm invocations.
  if (!clientPromise) clientPromise = connect();
  return clientPromise;
}

export default getClient;

export async function getDb(dbName: string = DB_NAME): Promise<Db> {
  const client = await getClient();
  return client.db(dbName);
}
