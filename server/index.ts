import cors from 'cors';
import express from 'express';
import serverlessHttp from 'serverless-http';
import { errorHandler } from './middleware/errorHandler';
import authRouter from './routes/auth';
import adminUsersRouter from './routes/admin/users';
import categoriesRouter from './routes/categories';
import adminCategoriesRouter from './routes/admin/categories';
import dotenv from 'dotenv'
dotenv.config()

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use('/api/auth', authRouter);
app.use('/api/categories', categoriesRouter);
app.use('/api/admin/users', adminUsersRouter);
app.use('/api/admin/categories', adminCategoriesRouter);

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
