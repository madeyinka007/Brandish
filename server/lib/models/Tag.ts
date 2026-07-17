import type { Model } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export interface TagDoc {
  _id: string;
  name: string;
  slug: string;
  createdAt: Date;
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
      },
      // Tags are create/delete only (no update route), so only createdAt is meaningful —
      // matches the schema in docs/data-model.md, which lists createdAt but not updatedAt.
      { timestamps: { createdAt: true, updatedAt: false } },
      [[{ slug: 1 }, { unique: true }]],
    ).then((model) => new TagModel(model));
  }
  return tagModelPromise;
}
