import { Schema, type Model } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export type PostFormat = 'article' | 'gallery' | 'video';
export type PostStatus = 'draft' | 'published' | 'scheduled' | 'archived';

/** Every valid format/status — source of truth for the schema enums and runtime validation. */
export const POST_FORMATS: readonly PostFormat[] = ['article', 'gallery', 'video'];
export const POST_STATUSES: readonly PostStatus[] = ['draft', 'published', 'scheduled', 'archived'];

/** Denormalised author snapshot — embedded for read speed (see docs/data-model.md). */
export interface PostAuthor {
  _id: string; // the real users._id value (stored as ObjectId — typed string here, like every *Doc._id)
  name: string;
  avatar: string;
}

export interface PostDoc {
  _id: string;
  title: string;
  slug: string;
  body: unknown; // Tiptap JSON (rich text)
  excerpt: string;
  format: PostFormat;
  coverImage: string;
  category: string; // denormalised category slug (immutable — see docs/data-model.md)
  tags: string[]; // denormalised tag slugs
  author: PostAuthor;
  media: string[]; // CloudFront URLs — required (non-empty) when format 'gallery'
  videoId: string | null; // YouTube id — required when format 'video'
  keywords: string;
  ogImage: string;
  status: PostStatus;
  viewCount: number;
  publishedAt: Date | null;
  createdAt: Date;
}

// `_id: false` so the embedded `_id` holds the real users._id rather than an auto-generated
// subdocument id (see docs/data-model.md). Built here rather than inline so createModel's
// plain-definition input can reference it as a nested schema.
const authorSchema = new Schema(
  {
    // ObjectId, not string — holds the real users._id. (PostAuthor types _id as string, like
    // every *Doc._id; no generic here so that surface typing doesn't clash with the schema type.)
    _id: { type: Schema.Types.ObjectId, required: true },
    name: { type: String, required: true },
    avatar: { type: String, default: '' },
  },
  { _id: false },
);

export class PostModel extends BaseModel<PostDoc> {
  // Public (BaseModel's constructor is protected) so the async factory below can build one.
  constructor(model: Model<PostDoc>) {
    super(model);
  }
}

// Same async-singleton pattern as User/Category/Tag — createModel awaits the cached
// connection, so the compiled model (and the PostModel wrapping it) is only via a promise.
let postModelPromise: Promise<PostModel> | null = null;

export function getPostModel(): Promise<PostModel> {
  if (!postModelPromise) {
    postModelPromise = MongoLibrary.createModel<PostDoc>(
      'Post',
      {
        title: { type: String, required: true, maxlength: 255 },
        slug: { type: String, required: true },
        body: { type: Schema.Types.Mixed, default: {} },
        excerpt: { type: String, default: '' },
        format: { type: String, enum: POST_FORMATS as unknown as string[], default: 'article' },
        coverImage: { type: String, default: '' },
        category: { type: String, required: true },
        tags: { type: [String], default: [] },
        author: { type: authorSchema, required: true },
        // Format-conditional backstop (the route/service also returns 422 before this runs —
        // see docs/data-model.md#posts). `media` is required only for 'gallery', so a plain
        // `required: true` would wrongly reject every other format; check the sibling instead.
        media: {
          type: [String],
          default: [],
          validate: {
            validator: function (this: { format: string }, value: string[]) {
              return this.format !== 'gallery' || (value?.length ?? 0) > 0;
            },
            message: 'media is required when format is "gallery"',
          },
        },
        videoId: {
          type: String,
          default: null,
          validate: {
            validator: function (this: { format: string }, value: string | null) {
              return this.format !== 'video' || !!value;
            },
            message: 'videoId is required when format is "video"',
          },
        },
        keywords: { type: String, default: '' },
        ogImage: { type: String, default: '' },
        status: { type: String, enum: POST_STATUSES as unknown as string[], default: 'draft' },
        viewCount: { type: Number, default: 0 },
        publishedAt: { type: Date, default: null },
      },
      // data-model.md lists only createdAt for posts (no updatedAt).
      { timestamps: { createdAt: true, updatedAt: false } },
      [
        [{ slug: 1 }, { unique: true }],
        [{ category: 1, status: 1, publishedAt: -1 }],
        [{ status: 1, publishedAt: -1 }],
        [{ tags: 1, status: 1, publishedAt: -1 }],
        // Text index backing GET /api/search (see docs/api-routes.md). 'text' isn't a 1|-1
        // sort direction, so this tuple is cast past createModel's numeric-index typing.
        [{ title: 'text', excerpt: 'text' } as unknown as Record<string, 1 | -1>],
      ],
    ).then((model) => new PostModel(model));
  }
  return postModelPromise;
}
