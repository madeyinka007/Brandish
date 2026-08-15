import type { NextFunction, Request, Response } from 'express';

const RECAPTCHA_SCORE_THRESHOLD = 0.5;

interface RecaptchaResponse {
  success: boolean;
  score: number;
}

export async function validateRecaptcha(req: Request, res: Response, next: NextFunction) {
  // LOCAL-DEV FALLBACK — skip verification when reCAPTCHA can't be enforced: no secret, or the
  // local dev signal AUTH_STORE=memory (which also switches the token/rate-limit stores to memory).
  // Keep AUTH_STORE unset and RECAPTCHA_SECRET set in production for full verification.
  if (!process.env.RECAPTCHA_SECRET || process.env.AUTH_STORE === 'memory') {
    return next();
  }

  const { recaptchaToken } = req.body;
  if (!recaptchaToken) {
    return res.status(400).json({ error: 'reCAPTCHA token required', code: 'MISSING_RECAPTCHA_TOKEN' });
  }

  try {
    const response = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `secret=${process.env.RECAPTCHA_SECRET}&response=${recaptchaToken}`,
    });
    const data = (await response.json()) as RecaptchaResponse;

    if (!data.success || data.score < RECAPTCHA_SCORE_THRESHOLD) {
      // Silent discard — do not expose detection logic to bots
      return res.status(200).json({ message: 'Received' });
    }
  } catch {
    // Google unreachable, or its response didn't parse — fail the same way a low score
    // does. A 4xx/5xx here would be just as revealing to a bot as an honest rejection.
    return res.status(200).json({ message: 'Received' });
  }

  next();
}
