jest.mock('../../lib/models/Subscriber', () => {
  const actual = jest.requireActual('../../lib/models/Subscriber');
  return { ...actual, getSubscriberModel: jest.fn() };
});
jest.mock('../../lib/ses', () => ({ sendEmail: jest.fn() }));

import { getSubscriberModel } from '../../lib/models/Subscriber';
import { sendEmail } from '../../lib/ses';
import * as newsletter from '../../services/newsletter';

let model: {
  findOne: jest.Mock;
  find: jest.Mock;
  findById: jest.Mock;
  create: jest.Mock;
  update: jest.Mock;
  paginate: jest.Mock;
  count: jest.Mock;
  delete: jest.Mock;
};

beforeEach(() => {
  jest.clearAllMocks();
  model = {
    findOne: jest.fn().mockResolvedValue(null),
    find: jest.fn().mockResolvedValue([]),
    findById: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation(async (d) => ({ _id: 's1', ...d })),
    update: jest.fn().mockImplementation(async (_f, d) => ({ _id: 's1', ...(d?.$set ?? {}) })),
    paginate: jest.fn().mockResolvedValue({
      data: [],
      total: 0,
      page: 1,
      limit: 100,
      totalPages: 0,
    }),
    count: jest.fn().mockResolvedValue(0),
    delete: jest.fn().mockResolvedValue({ _id: 's1' }),
  };
  (getSubscriberModel as jest.Mock).mockResolvedValue(model);
  (sendEmail as jest.Mock).mockResolvedValue(undefined);
});

describe('subscribe', () => {
  test('400 INVALID_EMAIL on a malformed address', async () => {
    await expect(newsletter.subscribe({ email: 'not-an-email' })).rejects.toMatchObject({
      statusCode: 400,
      code: 'INVALID_EMAIL',
    });
    expect(model.create).not.toHaveBeenCalled();
  });

  test('creates a pending subscriber with a token and sends the confirmation email', async () => {
    const result = await newsletter.subscribe({ email: 'Reader@Example.com ', source: 'footer' });

    expect(result).toEqual({ outcome: 'pending', email: 'reader@example.com' });
    expect(model.create).toHaveBeenCalledWith({
      email: 'reader@example.com',
      status: 'pending',
      token: expect.any(String),
      confirmedAt: null,
      source: 'footer',
      categories: [],
    });
    expect(sendEmail).toHaveBeenCalledWith(
      'reader@example.com',
      expect.any(String),
      expect.stringContaining('/api/newsletter/confirm?token='),
    );
  });

  test('an already-confirmed address is a no-op (no second email)', async () => {
    model.findOne.mockResolvedValue({ email: 'reader@example.com', status: 'subscribed' });

    const result = await newsletter.subscribe({ email: 'reader@example.com' });

    expect(result.outcome).toBe('already_subscribed');
    expect(model.create).not.toHaveBeenCalled();
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('a pending address re-signs up with a fresh token and a new email', async () => {
    model.findOne.mockResolvedValue({ email: 'reader@example.com', status: 'pending' });

    await newsletter.subscribe({ email: 'reader@example.com', source: 'sidebar' });

    expect(model.update).toHaveBeenCalledWith(
      { email: 'reader@example.com' },
      expect.objectContaining({
        $set: expect.objectContaining({ status: 'pending', source: 'sidebar' }),
      }),
    );
    expect(model.create).not.toHaveBeenCalled();
    expect(sendEmail).toHaveBeenCalledTimes(1);
  });

  test('the unique-index race (E11000) is treated as already subscribed', async () => {
    model.create.mockRejectedValue(Object.assign(new Error('dup'), { code: 11000 }));

    const result = await newsletter.subscribe({ email: 'reader@example.com' });

    expect(result.outcome).toBe('already_subscribed');
    expect(sendEmail).not.toHaveBeenCalled();
  });

  test('a failed confirmation email surfaces 502 but the address is already stored', async () => {
    (sendEmail as jest.Mock).mockRejectedValue(new Error('SES down'));

    await expect(newsletter.subscribe({ email: 'reader@example.com' })).rejects.toMatchObject({
      statusCode: 502,
      code: 'CONFIRMATION_EMAIL_FAILED',
    });
    expect(model.create).toHaveBeenCalled();
  });
});

describe('confirm', () => {
  test('activates the subscriber and clears the token', async () => {
    model.findOne.mockResolvedValue({ email: 'reader@example.com', status: 'pending' });

    await newsletter.confirm('tok123');

    expect(model.update).toHaveBeenCalledWith(
      { token: 'tok123' },
      { $set: { status: 'subscribed', confirmedAt: expect.any(Date), token: null } },
    );
  });

  test('404 INVALID_TOKEN when the token matches nothing', async () => {
    model.findOne.mockResolvedValue(null);

    await expect(newsletter.confirm('nope')).rejects.toMatchObject({
      statusCode: 404,
      code: 'INVALID_TOKEN',
    });
  });

  test('400 INVALID_TOKEN on an empty token', async () => {
    await expect(newsletter.confirm('')).rejects.toMatchObject({ statusCode: 400 });
  });

  test('a second click on an already-confirmed link changes nothing', async () => {
    model.findOne.mockResolvedValue({ email: 'reader@example.com', status: 'subscribed' });

    await newsletter.confirm('tok123');

    expect(model.update).not.toHaveBeenCalled();
  });
});

describe('unsubscribe', () => {
  test('deactivates the subscriber and clears the token', async () => {
    model.findOne.mockResolvedValue({ email: 'reader@example.com', status: 'subscribed' });

    await expect(newsletter.unsubscribe('tok123')).resolves.toBe(true);

    expect(model.update).toHaveBeenCalledWith(
      { token: 'tok123' },
      { $set: { status: 'unsubscribed', confirmedAt: null, token: null } },
    );
  });

  test('an unknown token is a no-op', async () => {
    model.findOne.mockResolvedValue(null);

    await expect(newsletter.unsubscribe('nope')).resolves.toBe(false);
    expect(model.update).not.toHaveBeenCalled();
  });
});

describe('listSubscribers', () => {
  test('returns the page plus the per-status counts', async () => {
    model.paginate.mockResolvedValue({
      data: [{ _id: 's1', email: 'reader@example.com', status: 'subscribed' }],
      total: 1,
      page: 1,
      limit: 100,
      totalPages: 1,
    });
    model.count.mockImplementation(async (filter: Record<string, unknown>) =>
      filter.status === 'subscribed' ? 7 : 3,
    );

    const result = await newsletter.listSubscribers();

    expect(result.data).toHaveLength(1);
    expect(result.counts).toEqual({ all: 3, pending: 3, subscribed: 7, unsubscribed: 3 });
  });

  test('filters by status and escapes the search term', async () => {
    await newsletter.listSubscribers({ status: 'pending', search: 'a+b@example.com' });

    expect(model.paginate).toHaveBeenCalledWith(
      { status: 'pending', email: { $regex: 'a\\+b@example\\.com', $options: 'i' } },
      expect.objectContaining({ sort: '-createdAt' }),
    );
  });
});

describe('deleteSubscriber', () => {
  test('404 when the subscriber does not exist', async () => {
    model.delete.mockResolvedValue(null);

    await expect(newsletter.deleteSubscriber('s1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIBER_NOT_FOUND',
    });
  });
});

describe('resendConfirmation', () => {
  test('issues a fresh token, resets to pending and re-sends the email', async () => {
    model.findById.mockResolvedValue({ _id: 's1', email: 'reader@example.com', status: 'pending' });

    await newsletter.resendConfirmation('s1');

    expect(model.update).toHaveBeenCalledWith(
      { _id: 's1' },
      { $set: { status: 'pending', token: expect.any(String), confirmedAt: null } },
    );
    expect(sendEmail).toHaveBeenCalledWith(
      'reader@example.com',
      expect.any(String),
      expect.stringContaining('/api/newsletter/confirm?token='),
    );
  });

  test('404 when the subscriber does not exist', async () => {
    model.findById.mockResolvedValue(null);

    await expect(newsletter.resendConfirmation('s1')).rejects.toMatchObject({
      statusCode: 404,
      code: 'SUBSCRIBER_NOT_FOUND',
    });
  });
});
