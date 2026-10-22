import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as newsletterService from '../services/newsletter';

// Admin list — one page of subscribers plus the per-status totals the stat cards show.
export const listSubscribers = asyncHandler(async (req: Request, res: Response) => {
  const { status, search, page, limit } = req.query ?? {};
  const result = await newsletterService.listSubscribers({
    status,
    search,
    page,
    limit,
  });
  res.status(200).json(result);
});

// Admin CSV export — the same filter the list is showing, capped at the export limit.
export const exportSubscribers = asyncHandler(async (req: Request, res: Response) => {
  const { status, search } = req.query ?? {};
  const rows = await newsletterService.exportSubscribers({ status, search });

  const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const header = ['Email', 'Status', 'Source', 'Categories', 'Signed up', 'Confirmed'];
  const body = rows.map((s) => [
    s.email,
    s.status,
    s.source,
    (s.categories ?? []).join(', '),
    s.createdAt ? new Date(s.createdAt).toISOString() : '',
    s.confirmedAt ? new Date(s.confirmedAt).toISOString() : '',
  ]);
  const csv = [header, ...body].map((r) => r.map(escape).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="brandish-subscribers.csv"');
  res.status(200).send(csv);
});

// Re-issue the confirmation token and re-send the email (a pending subscriber whose first
// send failed, or an admin wanting to confirm someone by hand).
export const resendConfirmation = asyncHandler(async (req: Request, res: Response) => {
  const subscriber = await newsletterService.resendConfirmation(req.params.id);
  res.status(200).json({ message: 'Confirmation email sent', subscriber });
});

export const deleteSubscriber = asyncHandler(async (req: Request, res: Response) => {
  await newsletterService.deleteSubscriber(req.params.id);
  res.status(200).json({ message: 'Subscriber deleted' });
});
