import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const suppliersRouter = Router();
suppliersRouter.use(authenticate);

suppliersRouter.get('/', async (req, res, next) => {
  try {
    const suppliers = await prisma.supplier.findMany({ orderBy: { name: 'asc' } });
    res.json(suppliers);
  } catch (err) { next(err); }
});

suppliersRouter.get('/:id', async (req, res, next) => {
  try {
    const s = await prisma.supplier.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!s) return res.status(404).json({ error: 'Supplier not found' });
    res.json(s);
  } catch (err) { next(err); }
});

suppliersRouter.post('/', async (req, res, next) => {
  try {
    const { name, contactName, phone, email, address } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });
    const s = await prisma.supplier.create({ data: { name, contactName, phone, email, address } });
    res.status(201).json(s);
  } catch (err) { next(err); }
});

suppliersRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, contactName, phone, email, address } = req.body;
    const s = await prisma.supplier.update({
      where: { id: parseInt(req.params.id) },
      data: { name, contactName, phone, email, address },
    });
    res.json(s);
  } catch (err) { next(err); }
});

suppliersRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.supplier.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Supplier deleted' });
  } catch (err) { next(err); }
});
