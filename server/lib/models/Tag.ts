import type { Model } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export interface TagDoc {
  _id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TagModel extends BaseModel<TagDoc> {
  // Public (BaseModel's constructor is protected) so the async factory below can build one.
  constructor(model: Model<TagDoc>) {
    super(model);
  }
}

// Same async-singleton pattern as the other domain models.
let tagModelPromise: Promise<TagModel> | null = null;

export function getTagModel(): Promise<TagModel> {
  if (!tagModelPromise) {
    tagModelPromise = MongoLibrary.createModel<TagDoc>(
      'Tag',
      {
        name: { type: String, required: true },
        slug: { type: String, required: true },
        description: { type: String, default: '' },
        color: { type: String, default: '' },
      },
      // Tags support full CRUD (create/read/update/delete), so `updatedAt` is meaningful.
      { timestamps: true },
      [[{ slug: 1 }, { unique: true }]],
    ).then((model) => new TagModel(model));
  }
  return tagModelPromise;
}
