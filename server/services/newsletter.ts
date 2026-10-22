import crypto from 'crypto';
import { AppError } from '../lib/errors';
import { getSubscriberModel, type SubscriberDoc, type SubscriberStatus } from '../lib/models/Subscriber';
import { sendEmail } from '../lib/ses';
import { isEmail, isNonEmptyString } from '../lib/validation';

// Public origin of the Next.js app — where the confirm/unsubscribe redirects land. The API
// origin is where the clickable links in the email point, because the API is what activates
// the subscriber (the blog has no server-side DB access).
const FRONTEND_URL = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
const API_BASE_URL = (process.env.API_BASE_URL || 'http://localhost:3001').replace(/\/+$/, '');

const LIST_SORT = '-createdAt';
const LIST_LIMIT = 100;
/** How many rows the CSV export may contain in one go. */
const EXPORT_LIMIT = 5000;

export type SubscribeOutcome = 'pending' | 'already_subscribed';

export interface SubscribeResult {
  outcome: SubscribeOutcome;
  email: string;
}

export interface SubscriberListResult {
  data: SubscriberView[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  counts: { all: number; pending: number; subscribed: number; unsubscribed: number };
}

function normaliseEmail(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

/** Escapes a user-supplied search term for safe use inside a RegExp. */
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * The shape the API returns. The confirmation token is a credential — it activates the
 * subscriber and unsubscribes them — so it never leaves the service, even to the admin API.
 */
export type SubscriberView = Omit<SubscriberDoc, 'token'>;

/** A Mongoose document (or a plain object) reduced to its fields. */
type PlainDoc = Record<string, unknown> & { toObject?: () => Record<string, unknown> };

function toSubscriberView(doc: SubscriberDoc): SubscriberView {
  const source = doc as unknown as PlainDoc;
  const raw = typeof source.toObject === 'function' ? source.toObject() : { ...source };
  const { token, __v, ...rest } = raw;
  return rest as unknown as SubscriberView;
}

function confirmationUrl(token: string): string {
  return `${API_BASE_URL}/api/newsletter/confirm?token=${token}`;
}

function unsubscribeUrl(token: string): string {
  return `${API_BASE_URL}/api/newsletter/unsubscribe?token=${token}`;
}

function confirmationEmail(email: string, token: string): string {
  const confirm = confirmationUrl(token);
  const unsubscribe = unsubscribeUrl(token);
  return `
    <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;color:#111">
      <h1 style="font-size:24px;margin:24px 0 8px">brandish</h1>
      <p style="font-size:15px;line-height:1.6;color:#333">
        Please confirm your Brandish subscription to start receiving our reporting on money, energy,
        FMCG and the brands shaping them.
      </p>
      <p style="margin:28px 0">
        <a href="${confirm}" style="background:#B00D22;color:#fff;padding:12px 22px;border-radius:4px;text-decoration:none;font-weight:700;display:inline-block">
          Confirm subscription
        </a>
      </p>
      <p style="font-size:12px;color:#777;line-height:1.6">
        If the button does not work, copy this link into your browser:<br />
        <a href="${confirm}" style="color:#B00D22">${confirm}</a>
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:28px 0" />
      <p style="font-size:12px;color:#999">
        Didn't sign up? You can
        <a href="${unsubscribe}" style="color:#999">unsubscribe here</a>.
      </p>
    </div>
  `;
}

/**
 * Double opt-in sign-up (see docs/workflows.md).
 *
 * The row is written FIRST and the confirmation email sent afterwards, so a mail failure never
 * loses the address — the admin can re-send the confirmation from the Subscribers page. A
 * subscriber stays `pending` until they click the link, which is what makes `subscribed` a
 * meaningful list (no unverified addresses).
 */
export async function subscribe(input: {
  email: unknown;
  source?: unknown;
  categories?: unknown;
}): Promise<SubscribeResult> {
  const email = normaliseEmail(input.email);
  if (!isEmail(email)) {
    throw new AppError(400, 'INVALID_EMAIL', 'Enter a valid email address.');
  }

  const source = isNonEmptyString(input.source) ? input.source.trim() : 'footer';
  const categories = Array.isArray(input.categories)
    ? input.categories.filter((c): c is string => isNonEmptyString(c)).map((c) => c.trim())
    : [];

  const model = await getSubscriberModel();
  const existing = await model.findOne({ email });

  // Already confirmed — don't send another email, just tell the caller it was a no-op.
  if (existing && existing.status === 'subscribed') {
    return { outcome: 'already_subscribed', email };
  }

  const token = crypto.randomBytes(32).toString('hex');

  if (existing) {
    // Re-subscribing (previously unsubscribed, or a pending address that asked again):
    // issue a fresh token and start the opt-in over.
    await model.update({ email }, {
      $set: { status: 'pending', token, confirmedAt: null, source, categories },
    });
  } else {
    try {
      await model.create({ email, status: 'pending', token, confirmedAt: null, source, categories });
    } catch (err) {
      // The unique index is the race-safe backstop: two tabs submitting the same address.
      if ((err as { code?: number } | null)?.code === 11000) {
        return { outcome: 'already_subscribed', email };
      }
      throw err;
    }
  }

  try {
    await sendEmail(email, 'Confirm your Brandish subscription', confirmationEmail(email, token));
  } catch (err) {
    // The address is stored — surface a retryable error so the reader can try again (or the
    // admin can re-send from the Subscribers page) rather than pretending it worked.
    // eslint-disable-next-line no-console
    console.error('[newsletter] confirmation email failed', err);
    throw new AppError(502, 'CONFIRMATION_EMAIL_FAILED', 'We could not send the confirmation email. Please try again.');
  }

  return { outcome: 'pending', email };
}

/** Activates the subscriber behind a confirmation token. Idempotent — a second click is a no-op. */
export async function confirm(token: string): Promise<SubscriberDoc> {
  if (!token) throw new AppError(400, 'INVALID_TOKEN', 'This confirmation link is not valid.');

  const model = await getSubscriberModel();
  const subscriber = await model.findOne({ token });
  if (!subscriber) {
    throw new AppError(404, 'INVALID_TOKEN', 'This confirmation link is not valid.');
  }
  if (subscriber.status === 'subscribed') return subscriber;

  const updated = await model.update(
    { token },
    { $set: { status: 'subscribed', confirmedAt: new Date(), token: null } },
  );
  if (!updated) throw new AppError(404, 'INVALID_TOKEN', 'This confirmation link is not valid.');
  return updated;
}

/** Opt-out. Returns false when the token matches nothing (already used, or never existed). */
export async function unsubscribe(token: string): Promise<boolean> {
  if (!token) return false;

  const model = await getSubscriberModel();
  const subscriber = await model.findOne({ token });
  if (!subscriber) return false;

  await model.update(
    { token },
    { $set: { status: 'unsubscribed', confirmedAt: null, token: null } },
  );
  return true;
}

export interface ListSubscribersInput {
  status?: unknown;
  search?: unknown;
  page?: unknown;
  limit?: unknown;
}

/** Admin list — filtered, paginated, plus the per-status totals the dashboard cards show. */
export async function listSubscribers(input: ListSubscribersInput = {}): Promise<SubscriberListResult> {
  const model = await getSubscriberModel();

  const status = isNonEmptyString(input.status) ? input.status.trim() : '';
  const search = isNonEmptyString(input.search) ? input.search.trim() : '';

  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;
  if (search) filter.email = { $regex: escapeRegex(search), $options: 'i' };

  const page = Math.max(1, Number(input.page) || 1);
  const limit = Math.min(Math.max(1, Number(input.limit) || LIST_LIMIT), LIST_LIMIT);

  const [result, all, pending, subscribed, unsubscribed] = await Promise.all([
    model.paginate(filter, { sort: LIST_SORT, page, limit }),
    model.count({}),
    model.count({ status: 'pending' }),
    model.count({ status: 'subscribed' }),
    model.count({ status: 'unsubscribed' }),
  ]);

  return {
    data: result.data.map(toSubscriberView),
    total: result.total,
    page: result.page,
    limit: result.limit,
    totalPages: result.totalPages,
    counts: { all, pending, subscribed, unsubscribed },
  };
}

/** Every matching subscriber, up to EXPORT_LIMIT — feeds the CSV export. */
export async function exportSubscribers(input: { status?: unknown; search?: unknown } = {}): Promise<SubscriberView[]> {
  const model = await getSubscriberModel();

  const status = isNonEmptyString(input.status) ? input.status.trim() : '';
  const search = isNonEmptyString(input.search) ? input.search.trim() : '';

  const filter: Record<string, unknown> = {};
  if (status && status !== 'all') filter.status = status;
  if (search) filter.email = { $regex: escapeRegex(search), $options: 'i' };

  const rows = await model.find(filter, { sort: LIST_SORT, limit: EXPORT_LIMIT });
  return rows.map(toSubscriberView);
}

/** Permanent delete (the admin's "remove this subscriber" action). */
export async function deleteSubscriber(id: string): Promise<void> {
  const model = await getSubscriberModel();
  const deleted = await model.delete(id);
  if (!deleted) throw new AppError(404, 'SUBSCRIBER_NOT_FOUND', 'Subscriber not found');
}

/**
 * Issues a fresh confirmation token and re-sends the email. Used when the first send failed
 * (SES outage, bad address) and when the admin wants to re-confirm a pending subscriber.
 */
export async function resendConfirmation(id: string): Promise<SubscriberView> {
  const model = await getSubscriberModel();
  const subscriber = await model.findById(id);
  if (!subscriber) throw new AppError(404, 'SUBSCRIBER_NOT_FOUND', 'Subscriber not found');

  const token = crypto.randomBytes(32).toString('hex');
  const updated = await model.update(
    { _id: id },
    { $set: { status: 'pending', token, confirmedAt: null } },
  );
  if (!updated) throw new AppError(404, 'SUBSCRIBER_NOT_FOUND', 'Subscriber not found');

  try {
    await sendEmail(subscriber.email, 'Confirm your Brandish subscription', confirmationEmail(subscriber.email, token));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[newsletter] confirmation re-send failed', err);
    throw new AppError(502, 'CONFIRMATION_EMAIL_FAILED', 'Could not send the confirmation email.');
  }

  return toSubscriberView(updated);
}

/** Where the browser should land after a confirm/unsubscribe click. */
export function frontendUrl(path: string): string {
  return `${FRONTEND_URL}${path}`;
}

export const SUBSCRIBER_STATUS_LABEL: Record<SubscriberStatus, string> = {
  pending: 'Pending',
  subscribed: 'Subscribed',
  unsubscribed: 'Unsubscribed',
};
