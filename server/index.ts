import cors from 'cors';
import express from 'express';
import serverlessHttp from 'serverless-http';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import adminUsersRouter from './routes/admin/users';
import adminAuthorsRouter from './routes/admin/authors';
import postsRouter from './routes/posts';
import adminPostsRouter from './routes/admin/posts';
import categoriesRouter from './routes/categories';
import adminCategoriesRouter from './routes/admin/categories';
import tagsRouter from './routes/tags';
import adminTagsRouter from './routes/admin/tags';
import commentsRouter from './routes/comments';
import viewsRouter from './routes/views';
import adminCommentsRouter from './routes/admin/comments';
import adminAnalyticsRouter from './routes/admin/analytics';
import settingsRouter from './routes/settings';
import adminSettingsRouter from './routes/admin/settings';
import adminUploadUrlRouter from './routes/admin/upload-url';
import adminMediaRouter from './routes/admin/media';
import dotenv from 'dotenv'
dotenv.config()

const app = express();

// Allowed browser origins. The Origin header a browser sends NEVER has a trailing slash or
// path, so the configured value is normalised to scheme://host[:port] before comparison —
// FRONTEND_URL was stored in SSM as '.../amplifyapp.com/' and the trailing slash made every
// cross-origin admin request fail the CORS check.
function normaliseOrigin(value: string): string {
  try {
    return new URL(value.trim()).origin;
  } catch {
    return value.trim().replace(/\/+$/, '');
  }
}

/**
 * `https://example.com` and `https://www.example.com` are DIFFERENT origins to a browser.
 * The apex domain redirects to www, so every real visitor arrives with the www origin while
 * FRONTEND_URL holds the apex — which silently failed every cross-origin call, including
 * login. Accept both spellings of whatever is configured rather than depending on which one
 * happens to be stored.
 */
function withWwwVariant(origin: string): string[] {
  try {
    const url = new URL(origin);
    const host = url.hostname;
    const paired = host.startsWith('www.') ? host.slice(4) : `www.${host}`;
    const pairedUrl = new URL(origin);
    pairedUrl.hostname = paired;
    return [url.origin, pairedUrl.origin];
  } catch {
    return [origin];
  }
}

const allowedOrigins = [...new Set(
  [process.env.FRONTEND_URL, 'http://localhost:3000']
    .filter((v): v is string => !!v && v.trim() !== '')
    .map(normaliseOrigin)
    .flatMap(withWwwVariant),
)];

app.use(cors({
  // Reflect the caller's origin when it is allow-listed. Requests with no Origin header
  // (server-to-server, curl, Next.js server-side fetches) are not subject to CORS — allow them.
  origin(origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/posts', postsRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/tags', tagsRouter);
app.use('/api/comments', commentsRouter);
app.use('/api/views', viewsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/authors', adminAuthorsRouter);
app.use('/api/admin/posts', adminPostsRouter);
app.use('/api/admin/categories', adminCategoriesRouter);
app.use('/api/admin/tags', adminTagsRouter);
app.use('/api/admin/comments', adminCommentsRouter);
app.use('/api/admin/analytics', adminAnalyticsRouter);
app.use('/api/admin/settings', adminSettingsRouter);
app.use('/api/admin/upload-url', adminUploadUrlRouter);
app.use('/api/admin/media', adminMediaRouter);

// Error middleware must be registered after all routes.
app.use(errorHandler);

export const handler = serverlessHttp(app);
export { app };

if (require.main === module) {
  const port = process.env.PORT || 3001;
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
}
