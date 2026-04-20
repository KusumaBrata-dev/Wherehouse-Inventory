import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const boxesRouter = Router();
boxesRouter.use(authenticate);

// GET /api/boxes/:id/history — Get transaction history for a specific box
boxesRouter.get('/:id/history', async (req, res, next) => {
  try {
    const boxId = parseInt(req.params.id);
    const { limit = 30 } = req.query;

    const [box, history] = await Promise.all([
      prisma.box.findUnique({
        where: { id: boxId },
        select: { id: true, code: true, name: true }
      }),
      prisma.transaction.findMany({
        where: { boxId },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { date: 'desc' },
        take: parseInt(limit),
      })
    ]);

    if (!box) return res.status(404).json({ error: 'Box not found' });

    res.json({ box, history });
  } catch (err) {
    next(err);
  }
});

export default boxesRouter;
