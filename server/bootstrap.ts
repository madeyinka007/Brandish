import { loadSecrets } from './lib/loadSecrets';

// Lambda entry point for the API function (Handler: bootstrap.handler). It exists solely to
// guarantee ordering: the Express app's import chain connects to Mongo at import time
// (lib/mongoose.ts reads MONGODB_URI on load), so the SecureString secrets must be on
// process.env BEFORE './index' is ever imported. We therefore load secrets first, then
// dynamically import the real serverless-http handler. Both are cached across warm invocations.
//
// Locally (serverless dev / tests) index.handler is used directly; this file is Lambda-only.

let realHandler: ((event: unknown, context: unknown) => unknown) | undefined;

export async function handler(event: unknown, context: unknown): Promise<unknown> {
  if (!realHandler) {
    await loadSecrets();
    const mod = await import('./index'); // deferred so it reads the now-populated process.env
    realHandler = mod.handler as (event: unknown, context: unknown) => unknown;
  }
  return realHandler(event, context);
}
