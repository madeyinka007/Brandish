import type { Request, Response } from 'express';
import { asyncHandler } from '../lib/errors';
import * as categoriesService from '../services/categories';

export const listPublic = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoriesService.listPublic();
  res.status(200).json(categories);
});

export const listAll = asyncHandler(async (_req: Request, res: Response) => {
  const categories = await categoriesService.listAll();
  res.status(200).json(categories);
});

export const createCategory = asyncHandler(async (req: Request, res: Response) => {
  const { name, description, color, order, status, seo } = req.body ?? {};
  const category = await categoriesService.createCategory({ name, description, color, order, status, seo });
  res.status(201).json(category);
});

export const updateCategory = asyncHandler(async (req: Request, res: Response) => {
  const category = await categoriesService.updateCategory(req.params.id, req.body ?? {});
  res.status(200).json(category);
});

export const deleteCategory = asyncHandler(async (req: Request, res: Response) => {
  await categoriesService.deleteCategory(req.params.id);
  res.status(200).json({ message: 'Category deleted' });
});

export const reorder = asyncHandler(async (req: Request, res: Response) => {
  await categoriesService.reorder(req.body?.items);
  res.status(200).json({ message: 'Categories reordered' });
});
