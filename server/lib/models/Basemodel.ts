import type { FilterQuery, Model, PipelineStage, PopulateOptions, UpdateQuery } from 'mongoose';
import { MongoLibrary, type FindOptions, type PaginatedResult } from '../mongo';

type PopulateArg = string | PopulateOptions | (string | PopulateOptions)[];

/**
 * Abstract base class every domain model extends. The constructor takes a Mongoose
 * `Model<T>` and binds a `MongoLibrary<T>` instance to it; every method below just
 * delegates to that instance — `BaseModel` itself never touches Mongoose directly.
 *
 * Concrete domain models (Post, User, Category, Comment, ...) extend this to inherit the
 * full CRUD/aggregate/pagination surface automatically, adding only what's specific to
 * that collection. Controllers depend on those concrete classes, never on Mongoose or
 * `MongoLibrary` directly — this is the boundary that enforces that.
 */
export abstract class BaseModel<T> {
  private readonly lib: MongoLibrary<T>;

  protected constructor(model: Model<T>) {
    this.lib = new MongoLibrary<T>(model);
  }

  create(data: Partial<T>): Promise<T> {
    return this.lib.create(data);
  }

  find(filter?: FilterQuery<T>, options?: FindOptions): Promise<T[]> {
    return this.lib.find(filter, options);
  }

  findOne(filter: FilterQuery<T>, populate?: PopulateArg): Promise<T | null> {
    return this.lib.findOne(filter, populate);
  }

  findById(id: string, populate?: PopulateArg): Promise<T | null> {
    return this.lib.findById(id, populate);
  }

  /** Filter-based update — see `updateById` for the id-based form. */
  update(filter: FilterQuery<T>, data: UpdateQuery<T>): Promise<T | null> {
    return this.lib.updateOne(filter, data);
  }

  updateById(id: string, data: UpdateQuery<T>): Promise<T | null> {
    return this.lib.updateById(id, data);
  }

  /** Deletes by id — the form controllers need for `DELETE /:id` routes. */
  delete(id: string): Promise<T | null> {
    return this.lib.deleteById(id);
  }

  aggregate<R = T>(pipeline: PipelineStage[]): Promise<R[]> {
    return this.lib.aggregate<R>(pipeline);
  }

  /** Re-populates document(s) you already have — not a query-time populate (pass `populate` to find/findOne/findById for that). */
  populate(docs: T | T[], path: PopulateArg): Promise<T | T[]> {
    return this.lib.populate(docs, path);
  }

  paginate(filter?: FilterQuery<T>, options?: FindOptions): Promise<PaginatedResult<T>> {
    return this.lib.paginate(filter, options);
  }

  exists(filter: FilterQuery<T>): Promise<boolean> {
    return this.lib.exists(filter);
  }

  count(filter?: FilterQuery<T>): Promise<number> {
    return this.lib.count(filter);
  }
}
