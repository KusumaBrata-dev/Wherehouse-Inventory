import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const scanRouter = Router();
scanRouter.use(authenticate);

// GET /api/scan/:sku — Lookup item by SKU (for scanner)
// Returns: item info + current stock + rack locations
scanRouter.get('/:sku', async (req, res, next) => {
  try {
    const { sku } = req.params;

    const item = await prisma.item.findUnique({
      where: { sku },
      include: {
        category: true,
        stock: true,
        rackLocations: { orderBy: { rackCode: 'asc' } },
      },
    });

    if (!item) {
      return res.status(404).json({ error: `Item with SKU "${sku}" not found` });
    }

    res.json({
      id: item.id,
      name: item.name,
      sku: item.sku,
      unit: item.unit,
      category: item.category?.name || null,
      quantity: item.stock?.quantity ?? 0,
      minStock: item.minStock,
      isLowStock: (item.stock?.quantity ?? 0) <= item.minStock,
      rackLocations: item.rackLocations,
      primaryRack: item.rackLocations[0]?.rackCode || null,
    });
  } catch (err) {
    next(err);
  }
});
