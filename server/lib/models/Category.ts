import type { Model } from 'mongoose';
import { MongoLibrary } from '../mongo';
import { BaseModel } from '../model';

export type CategoryStatus = 'active' | 'hidden';

/** Every valid status — source of truth for the schema enum and runtime validation. */
export const CATEGORY_STATUSES: readonly CategoryStatus[] = ['active', 'hidden'];

export interface CategorySeo {
  title: string;
  description: string;
  keywords: string;
  ogImage: string; // CloudFront URL
}

export interface CategoryDoc {
  _id: string;
  name: string;
  slug: string;
  description: string;
  color: string;
  order: number;
  status: CategoryStatus;
  seo: CategorySeo;
  createdAt: Date;
  updatedAt: Date;
}

export class CategoryModel extends BaseModel<CategoryDoc> {
  // Public (BaseModel's constructor is protected) so the async factory below can build one.
  constructor(model: Model<CategoryDoc>) {
    super(model);
  }
}

// Same async-singleton pattern as the User model — createModel awaits the cached connection,
// so the compiled model (and the CategoryModel wrapping it) is only available via a promise.
let categoryModelPromise: Promise<CategoryModel> | null = null;

export function getCategoryModel(): Promise<CategoryModel> {
  if (!categoryModelPromise) {
    categoryModelPromise = MongoLibrary.createModel<CategoryDoc>(
      'Category',
      {
        name: { type: String, required: true },
        slug: { type: String, required: true },
        description: { type: String, default: '' },
        color: { type: String, default: '' },
        order: { type: Number, default: 0 },
        status: { type: String, enum: CATEGORY_STATUSES as unknown as string[], default: 'active' },
        seo: {
          title: { type: String, default: '' },
          description: { type: String, default: '' },
          keywords: { type: String, default: '' },
          ogImage: { type: String, default: '' },
        },
      },
      { timestamps: true },
      [
        [{ slug: 1 }, { unique: true }],
        [{ status: 1, order: 1 }],
      ],
    ).then((model) => new CategoryModel(model));
  }
  return categoryModelPromise;
}
