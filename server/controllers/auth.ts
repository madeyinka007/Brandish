import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as authService from '../services/auth';

export const login = asyncHandler(async (req: Request, res: Response) => {
  const { email, password } = req.body ?? {};
  const result = await authService.login(email, password);
  res.status(200).json(result);
});

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  const tokens = await authService.refresh(refreshToken);
  res.status(200).json(tokens);
});

export const logout = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.body ?? {};
  await authService.logout(refreshToken);
  res.status(200).json({ message: 'Logged out' });
});

export const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  await authService.forgotPassword(email);
  // Same response whether or not the email exists (enumeration-safe).
  res.status(200).json({ message: 'If an account exists for that email, a reset link has been sent' });
});

export const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  const { token, newPassword } = req.body ?? {};
  await authService.resetPassword(token, newPassword);
  res.status(200).json({ message: 'Your password has been reset' });
});

export const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  const { currentPassword, newPassword } = req.body ?? {};
  await authService.changePassword(userId, currentPassword, newPassword);
  res.status(200).json({ message: 'Your password has been changed' });
});

export const verifyEmail = asyncHandler(async (req: Request, res: Response) => {
  const token = (req.body?.token ?? req.query?.token) as unknown;
  await authService.verifyEmail(token);
  res.status(200).json({ message: 'Email verified' });
});

export const resendVerification = asyncHandler(async (req: Request, res: Response) => {
  const { email } = req.body ?? {};
  await authService.resendVerification(email);
  res.status(200).json({ message: 'If an account exists for that email, a verification link has been sent' });
});
