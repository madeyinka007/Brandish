import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as usersService from '../services/users';

export const listUsers = asyncHandler(async (req: Request, res: Response) => {
  const page = req.query.page ? Number(req.query.page) : undefined;
  const limit = req.query.limit ? Number(req.query.limit) : undefined;
  const users = await usersService.listUsers(page, limit);
  res.status(200).json(users);
});

export const createUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, password, role, avatar } = req.body ?? {};
  const user = await usersService.createUser({ name, email, password, role, avatar });
  res.status(201).json(user);
});

export const updateUser = asyncHandler(async (req: Request, res: Response) => {
  const { name, email, avatar } = req.body ?? {};
  const user = await usersService.updateUser(req.params.id, { name, email, avatar });
  res.status(200).json(user);
});

export const assignRole = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.assignRole(req.params.id, req.body?.role);
  res.status(200).json(user);
});

export const setStatus = asyncHandler(async (req: Request, res: Response) => {
  const user = await usersService.setStatus(req.params.id, req.body?.active);
  res.status(200).json(user);
});

export const deleteUser = asyncHandler(async (req: Request, res: Response) => {
  await usersService.deleteUser(req.params.id);
  res.status(200).json({ message: 'User deleted' });
});
