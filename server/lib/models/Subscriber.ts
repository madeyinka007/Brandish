import type { Model } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export type SubscriberStatus = 'pending' | 'subscribed' | 'unsubscribed';

/** Every valid status — source of truth for the schema enum and runtime validation. */
export const SUBSCRIBER_STATUSES: readonly SubscriberStatus[] = ['pending', 'subscribed', 'unsubscribed'];

export interface SubscriberDoc {
  _id: string;
  email: string;
  /** pending = signed up, awaiting the double opt-in click · subscribed = confirmed · unsubscribed = opted out. */
  status: SubscriberStatus;
  /** Single-use token for the confirm/unsubscribe links. Null once the subscriber is confirmed. */
  token: string | null;
  confirmedAt: Date | null;
  /** Where the sign-up came from (footer, sidebar, …) — lets the admin see which form converts. */
  source: string;
  /** Category slugs the subscriber asked for. Empty = subscribed to everything. */
  categories: string[];
  createdAt: Date;
  updatedAt: Date;
}

export class SubscriberModel extends BaseModel<SubscriberDoc> {
  // Public (BaseModel's constructor is protected) so the async factory below can build one.
  constructor(model: Model<SubscriberDoc>) {
    super(model);
  }
}

// Same async-singleton pattern as the other domain models.
let subscriberModelPromise: Promise<SubscriberModel> | null = null;

export function getSubscriberModel(): Promise<SubscriberModel> {
  if (!subscriberModelPromise) {
    subscriberModelPromise = MongoLibrary.createModel<SubscriberDoc>(
      'Subscriber',
      {
        email: { type: String, required: true, lowercase: true, trim: true },
        status: { type: String, enum: SUBSCRIBER_STATUSES as unknown as string[], default: 'pending' },
        token: { type: String, default: null },
        confirmedAt: { type: Date, default: null },
        source: { type: String, default: 'footer' },
        categories: { type: [String], default: [] },
      },
      // Subscribers are created, confirmed and unsubscribed over time — updatedAt is meaningful.
      { timestamps: true },
      [
        // One row per address. The service pre-checks for a clean message; this is the race-safe backstop.
        [{ email: 1 }, { unique: true }],
        // Backs the admin list (newest first, filtered by status).
        [{ status: 1, createdAt: -1 }],
      ],
    ).then((model) => new SubscriberModel(model));
  }
  return subscriberModelPromise;
}
