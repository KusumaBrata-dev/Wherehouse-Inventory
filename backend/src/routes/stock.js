import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const stockRouter = Router();
stockRouter.use(authenticate);

// GET /api/stock — Dashboard summary
stockRouter.get('/', async (req, res, next) => {
  try {
    const stocks = await prisma.stock.findMany({
      include: {
        item: { include: { category: true, rackLocations: true } },
      },
      orderBy: { item: { name: 'asc' } },
    });

    const total = stocks.length;
    const lowStock = stocks.filter(s => s.quantity <= s.item.minStock && s.item.minStock > 0).length;
    const outOfStock = stocks.filter(s => s.quantity === 0).length;
    const totalQty = stocks.reduce((sum, s) => sum + s.quantity, 0);

    res.json({ summary: { total, lowStock, outOfStock, totalQty }, stocks });
  } catch (err) {
    next(err);
  }
});

// GET /api/stock/:itemId
stockRouter.get('/:itemId', async (req, res, next) => {
  try {
    const stock = await prisma.stock.findUnique({
      where: { itemId: parseInt(req.params.itemId) },
      include: { item: true },
    });
    if (!stock) return res.status(404).json({ error: 'Stock not found' });
    res.json(stock);
  } catch (err) {
    next(err);
  }
});
