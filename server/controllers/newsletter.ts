import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as newsletterService from '../services/newsletter';

// Public newsletter sign-up. The row is written before the confirmation email goes out
// (see docs/workflows.md), so a failed send leaves a `pending` subscriber the admin can
// re-confirm rather than losing the address.
export const subscribe = asyncHandler(async (req: Request, res: Response) => {
  const { email, source, categories } = req.body ?? {};
  const result = await newsletterService.subscribe({ email, source, categories });

  if (result.outcome === 'already_subscribed') {
    return res.status(200).json({
      status: result.outcome,
      message: "You're already subscribed to Brandish.",
    });
  }

  res.status(201).json({
    status: result.outcome,
    message: 'Almost there — check your inbox to confirm your subscription.',
  });
});

// GET /api/newsletter/confirm?token=… — the double opt-in click. Activates the subscriber
// and sends the reader to the blog's thank-you page; a bad token lands on the same page
// with `status=invalid` rather than a raw JSON error.
export const confirm = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '');
  try {
    await newsletterService.confirm(token);
    return res.redirect(302, newsletterService.frontendUrl('/newsletter/confirm?status=confirmed'));
  } catch {
    return res.redirect(302, newsletterService.frontendUrl('/newsletter/confirm?status=invalid'));
  }
});

// GET /api/newsletter/unsubscribe?token=… — one-click opt-out from any newsletter email.
export const unsubscribe = asyncHandler(async (req: Request, res: Response) => {
  const token = String(req.query.token ?? '');
  await newsletterService.unsubscribe(token);
  res.redirect(302, newsletterService.frontendUrl('/newsletter/unsubscribe'));
});
