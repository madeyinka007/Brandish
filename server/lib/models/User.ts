import type { Model } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export type Role = 'super-admin' | 'editor' | 'author' | 'reader';

/** Every valid role — source of truth for schema enum and runtime validation. */
export const ROLES: readonly Role[] = ['super-admin', 'editor', 'author', 'reader'];

/** Roles that can author content (be assigned as a post's author). Excludes `reader`. */
export const CONTENT_ROLES: readonly Role[] = ['super-admin', 'editor', 'author'];

export interface UserDoc {
  _id: string;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  avatar: string;
  active: boolean;
  emailVerified: boolean;
  emailVerificationToken: string | null;
  passwordResetToken: string | null;
  passwordResetExpires: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Fields that must never leave the API: the bcrypt hash and the single-use account-lifecycle
 * tokens. `sanitizeUser` strips these before any response (see the "never return passwordHash"
 * rule in docs/development.md — extended here to the reset/verify tokens for the same reason).
 */
export type PublicUser = Omit<
  UserDoc,
  'passwordHash' | 'emailVerificationToken' | 'passwordResetToken' | 'passwordResetExpires'
>;

export function sanitizeUser(user: UserDoc): PublicUser {
  const obj: any = typeof (user as any).toObject === 'function' ? (user as any).toObject() : { ...user };
  delete obj.passwordHash;
  delete obj.emailVerificationToken;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj as PublicUser;
}

export class UserModel extends BaseModel<UserDoc> {
  // Public (BaseModel's constructor is protected) so the async factory below can build one.
  constructor(model: Model<UserDoc>) {
    super(model);
  }
}

// `MongoLibrary.createModel` is async (it awaits the cached connection), so the compiled
// model — and therefore the UserModel wrapping it — can only be obtained via a promise.
// Cache it at module scope so the schema is compiled exactly once per warm Lambda.
let userModelPromise: Promise<UserModel> | null = null;

export function getUserModel(): Promise<UserModel> {
  if (!userModelPromise) {
    userModelPromise = MongoLibrary.createModel<UserDoc>(
      'User',
      {
        name: { type: String, required: true },
        email: { type: String, required: true },
        passwordHash: { type: String, required: true },
        role: { type: String, enum: ROLES as unknown as string[], required: true },
        avatar: { type: String, default: '' },
        active: { type: Boolean, default: true },
        emailVerified: { type: Boolean, default: false },
        emailVerificationToken: { type: String, default: null },
        passwordResetToken: { type: String, default: null },
        passwordResetExpires: { type: Date, default: null },
      },
      { timestamps: true },
      [[{ email: 1 }, { unique: true }]],
    ).then((model) => new UserModel(model));
  }
  return userModelPromise;
}
