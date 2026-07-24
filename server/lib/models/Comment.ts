import { type Model, Schema } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export type CommentStatus = 'pending' | 'approved' | 'rejected';
export const COMMENT_STATUSES: readonly CommentStatus[] = ['pending', 'approved', 'rejected'];

export interface CommentDoc {
  _id: string;
  postId: string; // ref → posts._id
  authorName: string;
  authorEmail: string; // stored, never displayed publicly (docs/data-model.md)
  body: string; // plain text only — HTML stripped on write
  status: CommentStatus;
  ip: string;
  createdAt: Date;
}

export class CommentModel extends BaseModel<CommentDoc> {
  // Public (BaseModel's constructor is protected) so the async factory below can build one.
  constructor(model: Model<CommentDoc>) {
    super(model);
  }
}

// Same async-singleton pattern as the other domain models.
let commentModelPromise: Promise<CommentModel> | null = null;

export function getCommentModel(): Promise<CommentModel> {
  if (!commentModelPromise) {
    commentModelPromise = MongoLibrary.createModel<CommentDoc>(
      'Comment',
      {
        // ObjectId, not string — holds the real posts._id. (CommentDoc types postId as string,
        // like every *Doc field that maps to an ObjectId; cast, same as Post.author._id.)
        postId: { type: Schema.Types.ObjectId, required: true } as any,
        authorName: { type: String, required: true },
        authorEmail: { type: String, required: true },
        body: { type: String, required: true },
        status: { type: String, enum: COMMENT_STATUSES as unknown as string[], default: 'pending' },
        ip: { type: String, default: '' },
      },
      // Comments are immutable once posted apart from `status` — `createdAt` only, no `updatedAt`
      // (matches the data-model schema, which carries no updatedAt field).
      { timestamps: { createdAt: true, updatedAt: false } },
      [[{ postId: 1, status: 1 }]], // every public comments fetch filters by (postId, status)
    ).then((model) => new CommentModel(model));
  }
  return commentModelPromise;
}
