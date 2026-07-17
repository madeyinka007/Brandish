import mongoose from 'mongoose';
import dotenv from 'dotenv'
dotenv.config();

const uri     = process.env.MONGODB_URI!;
const options = { maxPoolSize: 10, dbName: 'wt-brandish'}; // Atlas M0 max: 500 connections total

let connPromise: Promise<typeof mongoose>;

declare global {
  var _mongooseConnPromise: Promise<typeof mongoose> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  // In dev, reuse the cached connection across hot-reloads
  if (!global._mongooseConnPromise) {
    global._mongooseConnPromise = mongoose.connect(uri, options);
  }
  connPromise = global._mongooseConnPromise;
} else {
  // In production (Lambda), module scope is reused across warm invocations
  connPromise = mongoose.connect(uri,  options);
}

export default connPromise;

export async function dbConnect() {
  return connPromise;
}
