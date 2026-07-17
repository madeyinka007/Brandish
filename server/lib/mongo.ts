import mongoose, {
  Schema,
  type FilterQuery,
  type Model,
  type PipelineStage,
  type PopulateOptions,
  type SchemaDefinition,
  type UpdateQuery,
} from 'mongoose';
import { dbConnect } from './mongoose';

type PopulateArg = string | PopulateOptions | (string | PopulateOptions)[];

export interface FindOptions {
  sort?: string;
  page?: number;
  limit?: number;
  select?: string;
  populate?: PopulateArg;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

/**
 * The single point of contact with Mongoose for one specific model — construct one per
 * model (`new MongoLibrary(PostModel)`) and every Mongoose API call for that model goes
 * through the instance. No other class should `import mongoose from 'mongoose'` or call
 * a Mongoose model's methods directly; `BaseModel` (server/lib/model.ts) wraps this for
 * domain models, and controllers depend on those, never on this class directly.
 *
 * `createModel` is the one static exception — schema/model *definition* happens before
 * any model instance (and therefore any `MongoLibrary` instance) exists.
 *
 * Connection management is delegated to `dbConnect()` in `./mongoose` (the existing
 * cached-connection pattern from docs/workflows.md) rather than duplicated here — every
 * instance method below awaits `connect()` first, so callers never need to remember to
 * connect before querying.
 */
export class MongoLibrary<T> {
  constructor(private readonly model: Model<T>) {}

  private connect(): Promise<typeof mongoose> {
    return dbConnect();
  }

  /** Defines a schema (with optional indexes) and compiles it into a model — the only place `new Schema(...)`/`mongoose.model(...)` should appear. */
  static async createModel<T>(
    name: string,
    definition: SchemaDefinition<T>,
    // Mongoose's SchemaOptions<T> generic is parameterized by half a dozen inferred
    // document/method/virtual types with no clean way to satisfy them from a thin,
    // fully-generic wrapper like this one — accept a plain object and cast at the
    // one call site below instead of fighting the type checker for no practical benefit.
    options?: Record<string, unknown>,
    indexes?: Array<[Record<string, 1 | -1>, Record<string, unknown>?]>,
  ): Promise<Model<T>> {
    await dbConnect();
    const schema = new Schema<T>(definition, options as any);
    for (const [fields, indexOptions] of indexes ?? []) {
      schema.index(fields, indexOptions);
    }
    return mongoose.model<T>(name, schema);
  }

  // ---- CRUD ----

  async create(data: Partial<T>): Promise<T> {
    await this.connect();
    return this.model.create(data);
  }

  async findById(id: string, populate?: PopulateArg): Promise<T | null> {
    await this.connect();
    const query = this.model.findById(id);
    return (populate ? query.populate(populate as string) : query).exec();
  }

  async findOne(filter: FilterQuery<T>, populate?: PopulateArg): Promise<T | null> {
    await this.connect();
    const query = this.model.findOne(filter);
    return (populate ? query.populate(populate as string) : query).exec();
  }

  /** List query — filter is passed in explicitly by the caller (e.g. a route handler already validated/whitelisted req.query). */
  async find(filter: FilterQuery<T> = {}, options: FindOptions = {}): Promise<T[]> {
    await this.connect();
    let query = this.model.find(filter);

    if (options.sort) query = query.sort(options.sort);
    if (options.select) query = query.select(options.select);
    if (options.populate) query = query.populate(options.populate as string);

    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    query = query.skip((page - 1) * limit).limit(limit);

    return query.exec();
  }

  /** Same as `find`, plus `total`/`totalPages` computed from a parallel `count()`. */
  async paginate(filter: FilterQuery<T> = {}, options: FindOptions = {}): Promise<PaginatedResult<T>> {
    const page = Math.max(1, options.page ?? 1);
    const limit = Math.min(Math.max(1, options.limit ?? DEFAULT_LIMIT), MAX_LIMIT);
    const [data, total] = await Promise.all([
      this.find(filter, { ...options, page, limit }),
      this.count(filter),
    ]);
    return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
  }

  async updateById(id: string, data: UpdateQuery<T>): Promise<T | null> {
    await this.connect();
    return this.model.findByIdAndUpdate(id, data, { new: true, runValidators: true }).exec();
  }

  async updateOne(filter: FilterQuery<T>, data: UpdateQuery<T>): Promise<T | null> {
    await this.connect();
    return this.model.findOneAndUpdate(filter, data, { new: true, runValidators: true }).exec();
  }

  async deleteById(id: string): Promise<T | null> {
    await this.connect();
    return this.model.findByIdAndDelete(id).exec();
  }

  async deleteOne(filter: FilterQuery<T>): Promise<T | null> {
    await this.connect();
    return this.model.findOneAndDelete(filter).exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    await this.connect();
    return this.model.countDocuments(filter).exec();
  }

  async exists(filter: FilterQuery<T>): Promise<boolean> {
    await this.connect();
    const result = await this.model.exists(filter);
    return result !== null;
  }

  // ---- Aggregate ----

  async aggregate<R = T>(pipeline: PipelineStage[]): Promise<R[]> {
    await this.connect();
    return this.model.aggregate<R>(pipeline).exec();
  }

  /** Re-populates document(s) you already have — distinct from find/findById/findOne's `populate` option, which populates during the query itself. */
  async populate(docs: T | T[], path: PopulateArg): Promise<T | T[]> {
    await this.connect();
    return this.model.populate(docs as any, path as any);
  }
}
