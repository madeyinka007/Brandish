import 'dotenv/config';
import { getUserModel } from '../lib/models/User';
import { hashPassword } from '../lib/password';

/**
 * One-off bootstrap: creates the first `super-admin` so the account system has a starting
 * point. The API can't create it (every create route is super-admin-only — chicken and
 * egg), and it must be pre-verified (`emailVerified: true`), because login rejects
 * unverified accounts (see docs/auth.md).
 *
 * Idempotent — re-running does nothing once the account exists.
 *
 * Run:  node --env-file=.env node_modules/.bin/ts-node scripts/seedSuperAdmin.ts
 *   or: npm run seed:admin
 *
 * Credentials default to the values below but can be overridden via env. NOTE: `Admin@2026`
 * is a bootstrap credential — change it (via POST /api/auth/change-password) right after the
 * first login, and never commit real production secrets here.
 */
export const SEED_ADMIN = {
  name: process.env.SEED_ADMIN_NAME || 'Administrator',
  email: process.env.SEED_ADMIN_EMAIL || 'admin@brandish.com.ng',
  password: process.env.SEED_ADMIN_PASSWORD || 'Admin@2026',
};

export async function seedSuperAdmin(): Promise<'created' | 'exists'> {
  const users = await getUserModel();

  const existing = await users.findOne({ email: SEED_ADMIN.email });
  if (existing) {
    console.log(`Super-admin ${SEED_ADMIN.email} already exists; nothing to do.`);
    return 'exists';
  }

  const passwordHash = await hashPassword(SEED_ADMIN.password);
  try {
    const user = await users.create({
      name: SEED_ADMIN.name,
      email: SEED_ADMIN.email,
      passwordHash,
      role: 'super-admin',
      avatar: '',
      active: true,
      emailVerified: true, // pre-verified so login isn't chicken-and-egg
      emailVerificationToken: null,
      passwordResetToken: null,
      passwordResetExpires: null,
    });
    console.log(`Created super-admin ${SEED_ADMIN.email} (id ${String(user._id)}).`);
    return 'created';
  } catch (err: any) {
    // Unique-index race — another run beat us to it. Treat as already-seeded.
    if (err?.code === 11000) {
      console.log(`Super-admin ${SEED_ADMIN.email} already exists; nothing to do.`);
      return 'exists';
    }
    throw err;
  }
}

// Only run when invoked directly (not when imported by the test).
if (require.main === module) {
  seedSuperAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
