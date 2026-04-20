import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const categoriesRouter = Router();

categoriesRouter.use(authenticate);

// GET /api/categories — List all categories
categoriesRouter.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(categories);
  } catch (err) {
    next(err);
  }
});
