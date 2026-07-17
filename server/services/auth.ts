import crypto from 'crypto';
import { AppError } from '../lib/errors';
import { signAccessToken } from '../lib/jwt';
import { comparePassword, hashPassword } from '../lib/password';
import { consumeRefreshToken, revokeRefreshToken, storeRefreshToken } from '../lib/dynamo';
import { sendEmail } from '../lib/ses';
import { getUserModel, sanitizeUser, type PublicUser, type UserDoc } from '../lib/models/User';
import { isEmail, isNonEmptyString, isStrongPassword } from '../lib/validation';

const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days
const PASSWORD_RESET_TTL_MS = 60 * 60 * 1000; // 1 hour

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult extends TokenPair {
  user: PublicUser;
}

function generateOpaqueToken(): string {
  return crypto.randomBytes(40).toString('hex');
}

/** Signs a fresh access token and mints + persists a new (rotated) refresh token. */
async function issueTokens(user: UserDoc): Promise<TokenPair> {
  const accessToken = signAccessToken({
    userId: String(user._id),
    role: user.role,
    email: user.email,
  });
  const refreshToken = generateOpaqueToken();
  await storeRefreshToken(refreshToken, String(user._id), REFRESH_TOKEN_TTL_SECONDS);
  return { accessToken, refreshToken };
}

export async function login(email: unknown, password: unknown): Promise<AuthResult> {
  if (!isEmail(email) || !isNonEmptyString(password)) {
    throw new AppError(400, 'INVALID_CREDENTIALS_FORMAT', 'A valid email and password are required');
  }
  const users = await getUserModel();
  const user = await users.findOne({ email });
  // One generic message for missing user / inactive / wrong password — never reveal which,
  // to avoid account enumeration.
  if (!user || !user.active) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  const passwordOk = await comparePassword(password, user.passwordHash);
  if (!passwordOk) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }
  if (!user.emailVerified) {
    throw new AppError(403, 'EMAIL_NOT_VERIFIED', 'Please verify your email before signing in');
  }
  const tokens = await issueTokens(user);
  return { ...tokens, user: sanitizeUser(user) };
}

/** Rotation: the presented refresh token is consumed (deleted) and a brand-new pair issued. */
export async function refresh(refreshToken: unknown): Promise<TokenPair> {
  if (!isNonEmptyString(refreshToken)) {
    throw new AppError(400, 'MISSING_REFRESH_TOKEN', 'Refresh token is required');
  }
  const userId = await consumeRefreshToken(refreshToken);
  if (!userId) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }
  const users = await getUserModel();
  const user = await users.findById(userId);
  if (!user || !user.active) {
    throw new AppError(401, 'INVALID_REFRESH_TOKEN', 'Refresh token is invalid or expired');
  }
  return issueTokens(user);
}

/** Revokes the given refresh token. Idempotent — an absent/unknown token is not an error. */
export async function logout(refreshToken: unknown): Promise<void> {
  if (isNonEmptyString(refreshToken)) {
    await revokeRefreshToken(refreshToken);
  }
}

/**
 * Always resolves without error whether or not the email exists — the caller returns the
 * same generic message either way, so an attacker can't probe which addresses have
 * accounts. Only a real, active account actually receives a reset email.
 */
export async function forgotPassword(email: unknown): Promise<void> {
  if (!isEmail(email)) return;
  const users = await getUserModel();
  const user = await users.findOne({ email });
  if (!user || !user.active) return;
  const token = generateOpaqueToken();
  await users.updateById(String(user._id), {
    passwordResetToken: token,
    passwordResetExpires: new Date(Date.now() + PASSWORD_RESET_TTL_MS),
  });
  const link = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  await sendEmail(
    user.email,
    'Reset your password',
    `<p>We received a request to reset your password. This link expires in 1 hour:</p><p><a href="${link}">${link}</a></p>`,
  );
}

export async function resetPassword(token: unknown, newPassword: unknown): Promise<void> {
  if (!isNonEmptyString(token)) {
    throw new AppError(400, 'MISSING_RESET_TOKEN', 'Reset token is required');
  }
  if (!isStrongPassword(newPassword)) {
    throw new AppError(400, 'WEAK_PASSWORD', 'Password must be at least 8 characters');
  }
  const users = await getUserModel();
  const user = await users.findOne({ passwordResetToken: token });
  if (!user || !user.passwordResetExpires || user.passwordResetExpires.getTime() < Date.now()) {
    throw new AppError(400, 'INVALID_RESET_TOKEN', 'Reset token is invalid or expired');
  }
  const passwordHash = await hashPassword(newPassword);
  await users.updateById(String(user._id), {
    passwordHash,
    passwordResetToken: null,
    passwordResetExpires: null,
  });
}

export async function changePassword(
  userId: string,
  currentPassword: unknown,
  newPassword: unknown,
): Promise<void> {
  if (!isNonEmptyString(currentPassword) || !isStrongPassword(newPassword)) {
    throw new AppError(400, 'INVALID_PASSWORD_CHANGE', 'Current password and a new password (min 8 chars) are required');
  }
  const users = await getUserModel();
  const user = await users.findById(userId);
  if (!user) {
    throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
  }
  const currentOk = await comparePassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
  }
  const passwordHash = await hashPassword(newPassword);
  await users.updateById(userId, { passwordHash });
}

export async function verifyEmail(token: unknown): Promise<void> {
  if (!isNonEmptyString(token)) {
    throw new AppError(400, 'MISSING_VERIFICATION_TOKEN', 'Verification token is required');
  }
  const users = await getUserModel();
  const user = await users.findOne({ emailVerificationToken: token });
  if (!user) {
    throw new AppError(400, 'INVALID_VERIFICATION_TOKEN', 'Verification token is invalid');
  }
  await users.updateById(String(user._id), {
    emailVerified: true,
    emailVerificationToken: null,
  });
}

/**
 * Re-issues an email-verification token and re-sends the email. Enumeration-safe (always
 * resolves). This is the only place that *issues* a verification token today — once the
 * Users module exists, user creation should also issue one on the same field (see the
 * note in docs/auth.md).
 */
export async function resendVerification(email: unknown): Promise<void> {
  if (!isEmail(email)) return;
  const users = await getUserModel();
  const user = await users.findOne({ email });
  if (!user || user.emailVerified) return;
  const token = generateOpaqueToken();
  await users.updateById(String(user._id), { emailVerificationToken: token });
  const link = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  await sendEmail(
    user.email,
    'Verify your email',
    `<p>Confirm your email address to activate your account:</p><p><a href="${link}">${link}</a></p>`,
  );
}
