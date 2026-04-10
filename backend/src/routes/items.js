import { Router } from 'express';
import QRCode from 'qrcode';
import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const itemsRouter = Router();

// ── Public endpoints (no auth needed — browser loads img tags) ────────────

// GET /api/items/:id/qr — Generate QR code image (PNG)
itemsRouter.get('/:id/qr', async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const qrData = JSON.stringify({ sku: item.sku, name: item.name });
    const qrBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
      color: { dark: '#0f1629', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${item.sku}.png"`);
    res.send(qrBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id/barcode — Generate Barcode image (PNG)
itemsRouter.get('/:id/barcode', async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!item) return res.status(404).json({ error: 'Item not found' });

    const canvas = createCanvas(400, 150);
    JsBarcode(canvas, item.sku, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true,
      text: `${item.sku} | ${item.name}`,
      textMargin: 5,
      fontSize: 14,
      background: '#ffffff',
      lineColor: '#0f1629',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="barcode-${item.sku}.png"`);
    canvas.createPNGStream().pipe(res);
  } catch (err) {
    next(err);
  }
});

// ── Auth-protected routes ─────────────────────────────────────────────────
itemsRouter.use(authenticate);

// GET /api/items — List all items with stock
itemsRouter.get('/', async (req, res, next) => {
  try {
    const { search, category, lowStock } = req.query;
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.categoryId = parseInt(category);

    let items = await prisma.item.findMany({
      where,
      include: {
        category: true,
        stock: true,
        rackLocations: true,
      },
      orderBy: { name: 'asc' },
    });

    if (lowStock === 'true') {
      items = items.filter(item => (item.stock?.quantity ?? 0) <= item.minStock);
    }

    res.json(items);
  } catch (err) {
    next(err);
  }
});

// GET /api/items/:id
itemsRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.item.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { category: true, stock: true, rackLocations: true },
    });
    if (!item) return res.status(404).json({ error: 'Item not found' });
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// POST /api/items — Create item
itemsRouter.post('/', async (req, res, next) => {
  try {
    const { name, sku, categoryId, unit, description, minStock } = req.body;
    if (!name || !sku || !unit) {
      return res.status(400).json({ error: 'name, sku, and unit are required' });
    }

    const item = await prisma.$transaction(async (tx) => {
      const created = await tx.item.create({
        data: { name, sku, categoryId: categoryId ? parseInt(categoryId) : null, unit, description, minStock: minStock ? parseInt(minStock) : 0 },
      });
      // Auto-create stock record with 0 quantity
      await tx.stock.create({ data: { itemId: created.id, quantity: 0 } });
      return created;
    });

    const full = await prisma.item.findUnique({
      where: { id: item.id },
      include: { category: true, stock: true, rackLocations: true },
    });
    res.status(201).json(full);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'SKU already exists' });
    next(err);
  }
});

// PUT /api/items/:id — Update item
itemsRouter.put('/:id', async (req, res, next) => {
  try {
    const { name, sku, categoryId, unit, description, minStock } = req.body;
    const item = await prisma.item.update({
      where: { id: parseInt(req.params.id) },
      data: { name, sku, categoryId: categoryId ? parseInt(categoryId) : null, unit, description, minStock: minStock ? parseInt(minStock) : 0 },
      include: { category: true, stock: true, rackLocations: true },
    });
    res.json(item);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Item not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'SKU already exists' });
    next(err);
  }
});

// DELETE /api/items/:id
itemsRouter.delete('/:id', async (req, res, next) => {
  try {
    await prisma.item.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Item deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Item not found' });
    next(err);
  }
});

