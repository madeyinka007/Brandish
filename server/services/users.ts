import crypto from 'crypto';
import { AppError } from '../lib/errors';
import { hashPassword } from '../lib/password';
import { sendEmail } from '../lib/ses';
import { getUserModel, sanitizeUser, ROLES, CONTENT_ROLES, type PublicUser, type Role, type UserDoc } from '../lib/models/User';
import { isEmail, isNonEmptyString, isStrongPassword } from '../lib/validation';

// Every read/write below returns users through `sanitizeUser` — the single, consistent
// projection strategy (it strips passwordHash AND the reset/verification tokens, which a
// bare `select: '-passwordHash'` would miss). Never return a raw user doc from this module.

function isValidRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export interface CreateUserInput {
  name: unknown;
  email: unknown;
  password: unknown;
  role: unknown;
  avatar?: unknown;
}

export async function listUsers(page?: number, limit?: number): Promise<PublicUser[]> {
  const users = await getUserModel();
  const docs = await users.find({}, { page, limit, sort: '-createdAt' });
  return docs.map(sanitizeUser);
}

export interface AuthorSummary {
  _id: string;
  name: string;
  avatar: string;
  role: Role;
}

/**
 * Active users who can author content (role in CONTENT_ROLES) — the pool a post can be
 * assigned to. Returns MINIMAL fields only (no email/tokens): this is exposed to editors (not
 * just super-admins) so the post editor can populate its author picker.
 */
export async function listAuthors(): Promise<AuthorSummary[]> {
  const users = await getUserModel();
  const docs = await users.find(
    { role: { $in: CONTENT_ROLES as unknown as Role[] }, active: true },
    { sort: 'name', limit: 200 },
  );
  return docs.map((u) => ({ _id: String(u._id), name: u.name, avatar: u.avatar ?? '', role: u.role }));
}

export async function createUser(input: CreateUserInput): Promise<PublicUser> {
  const { name, email, password, role, avatar } = input;
  if (!isNonEmptyString(name) || !isEmail(email) || !isStrongPassword(password) || !isValidRole(role)) {
    throw new AppError(400, 'INVALID_USER_INPUT', 'name, a valid email, a password (min 8 chars), and a valid role are required');
  }

  const users = await getUserModel();
  const passwordHash = await hashPassword(password); // never store the plaintext
  const emailVerificationToken = crypto.randomBytes(32).toString('hex');

  let user: UserDoc;
  try {
    user = await users.create({
      name,
      email,
      passwordHash,
      role,
      avatar: isNonEmptyString(avatar) ? avatar : '',
      emailVerified: false,
      emailVerificationToken,
    });
  } catch (err: any) {
    // Unique index on `email` — race-free duplicate detection (a pre-check would race).
    if (err?.code === 11000) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with that email already exists');
    }
    throw err;
  }

  // Issue the initial verification email — this is the cross-module dependency flagged in
  // docs/auth.md (auth's verify-email/resend-verification only consume the token; this is
  // where a real create issues it).
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${emailVerificationToken}`;
  await sendEmail(
    email,
    'Verify your email',
    `<p>An account has been created for you. Confirm your email address to activate it:</p><p><a href="${link}">${link}</a></p>`,
  );

  return sanitizeUser(user);
}

/** Edits `name` / `email` / `avatar` only — role and status have their own endpoints. */
export async function updateUser(
  id: string,
  data: { name?: unknown; email?: unknown; avatar?: unknown },
): Promise<PublicUser> {
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) {
    if (!isNonEmptyString(data.name)) throw new AppError(400, 'INVALID_USER_INPUT', 'name must be a non-empty string');
    update.name = data.name;
  }
  if (data.email !== undefined) {
    if (!isEmail(data.email)) throw new AppError(400, 'INVALID_USER_INPUT', 'email must be valid');
    update.email = data.email;
  }
  if (data.avatar !== undefined) {
    update.avatar = isNonEmptyString(data.avatar) ? data.avatar : '';
  }

  const users = await getUserModel();
  let user: UserDoc | null;
  try {
    user = await users.updateById(id, update);
  } catch (err: any) {
    if (err?.code === 11000) {
      throw new AppError(409, 'EMAIL_EXISTS', 'A user with that email already exists');
    }
    throw err;
  }
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return sanitizeUser(user);
}

export async function assignRole(id: string, role: unknown): Promise<PublicUser> {
  if (!isValidRole(role)) {
    throw new AppError(400, 'INVALID_ROLE', `role must be one of: ${ROLES.join(', ')}`);
  }
  const users = await getUserModel();
  const user = await users.updateById(id, { role });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return sanitizeUser(user);
}

export async function setStatus(id: string, active: unknown): Promise<PublicUser> {
  if (typeof active !== 'boolean') {
    throw new AppError(400, 'INVALID_STATUS', 'active must be a boolean');
  }
  const users = await getUserModel();
  const user = await users.updateById(id, { active });
  if (!user) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  return sanitizeUser(user);
}

export async function deleteUser(id: string): Promise<void> {
  const users = await getUserModel();
  const deleted = await users.delete(id);
  if (!deleted) throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  // Hard delete. `posts.authorId` is intentionally NOT cascaded — the frontend renders a
  // deleted author as "Deleted author" (see docs/api-routes.md).
}
