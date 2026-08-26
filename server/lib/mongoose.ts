import mongoose from 'mongoose';
import dotenv from 'dotenv'
dotenv.config();

const uri     = process.env.MONGODB_URI!;
const options = { maxPoolSize: 10, dbName: 'wt-brandish'}; // Atlas M0 max: 500 connections total

declare global {
  // TypeScript global augmentation requires `var` — `let`/`const` do not create a
  // property on globalThis.
  // eslint-disable-next-line no-var
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined;
}

// Cached connection attempt. Deliberately NOT created at module load: connecting at import
// time meant that if Atlas was slow/unreachable (server selection times out after 30s), the
// rejection had no handler attached yet, so Node 22 killed the whole Lambda container with
// Runtime.UnhandledPromiseRejection — surfacing as a 500 on the first request after a cold
// start. Connecting inside dbConnect() means a caller is always awaiting it.
let connPromise: Promise<typeof mongoose> | undefined;

function connect(): Promise<typeof mongoose> {
  const p = mongoose.connect(uri, options);
  // If this attempt fails, drop it from the cache so the NEXT request retries instead of
  // being served the same permanently-rejected promise for the life of the warm container.
  p.catch(() => {
    if (connPromise === p) connPromise = undefined;
    if (global._mongooseConnPromise === p) global._mongooseConnPromise = undefined;
  });
  return p;
}

export async function dbConnect() {
  if (process.env.NODE_ENV === 'development') {
    // In dev, reuse the cached connection across hot-reloads.
    if (!global._mongooseConnPromise) global._mongooseConnPromise = connect();
    return global._mongooseConnPromise;
  }
  // In production (Lambda), module scope is reused across warm invocations.
  if (!connPromise) connPromise = connect();
  return connPromise;
}

export default dbConnect;
