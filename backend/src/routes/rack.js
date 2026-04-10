import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const rackRouter = Router();
rackRouter.use(authenticate);

// GET /api/rack/:itemId
rackRouter.get('/:itemId', async (req, res, next) => {
  try {
    const racks = await prisma.rackLocation.findMany({
      where: { itemId: parseInt(req.params.itemId) },
      orderBy: { rackCode: 'asc' },
    });
    res.json(racks);
  } catch (err) {
    next(err);
  }
});

// POST /api/rack — Assign rack to item
rackRouter.post('/', async (req, res, next) => {
  try {
    const { itemId, rackCode, row, level, notes } = req.body;
    if (!itemId || !rackCode || !row || level === undefined) {
      return res.status(400).json({ error: 'itemId, rackCode, row, and level are required' });
    }
    const rack = await prisma.rackLocation.create({
      data: { itemId: parseInt(itemId), rackCode: rackCode.toUpperCase(), row: row.toUpperCase(), level: parseInt(level), notes },
    });
    res.status(201).json(rack);
  } catch (err) {
    next(err);
  }
});

// PUT /api/rack/:id
rackRouter.put('/:id', async (req, res, next) => {
  try {
    const { rackCode, row, level, notes } = req.body;
    const rack = await prisma.rackLocation.update({
      where: { id: parseInt(req.params.id) },
      data: { rackCode: rackCode?.toUpperCase(), row: row?.toUpperCase(), level: level ? parseInt(level) : undefined, notes },
    });
    res.json(rack);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/rack/:id
rackRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.rackLocation.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Rack location removed' });
  } catch (err) {
    next(err);
  }
});
