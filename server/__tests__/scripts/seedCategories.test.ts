jest.mock('../../lib/mongoose', () => ({ dbConnect: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../lib/models/Category', () => {
  const actual = jest.requireActual('../../lib/models/Category');
  return { ...actual, getCategoryModel: jest.fn() };
});

import { getCategoryModel } from '../../lib/models/Category';
import { seedCategories } from '../../scripts/seedCategories';

let model: { exists: jest.Mock; create: jest.Mock };

beforeEach(() => {
  jest.clearAllMocks();
  model = { exists: jest.fn(), create: jest.fn().mockResolvedValue({}) };
  (getCategoryModel as jest.Mock).mockResolvedValue(model);
});

describe('seedCategories', () => {
  test('creates all 10 verticals (active, sequential order) when none exist', async () => {
    model.exists.mockResolvedValue(false);

    const result = await seedCategories();

    expect(result).toEqual({ created: 10, skipped: 0 });
    expect(model.create).toHaveBeenCalledTimes(10);
    const first = model.create.mock.calls[0][0];
    expect(first).toMatchObject({ slug: 'advertising', status: 'active', order: 0 });
  });

  test('is idempotent — skips categories that already exist', async () => {
    model.exists.mockResolvedValue(true);

    const result = await seedCategories();

    expect(result).toEqual({ created: 0, skipped: 10 });
    expect(model.create).not.toHaveBeenCalled();
  });
});
