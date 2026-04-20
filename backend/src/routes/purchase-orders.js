import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireAdminOrPPIC } from '../middleware/auth.js';
import { validate, receivePOSchema } from '../validations/wms.js';

export const purchaseOrdersRouter = Router();

purchaseOrdersRouter.use(authenticate);

// GET /api/purchase-orders
purchaseOrdersRouter.get('/', async (req, res, next) => {
  try {
    const pos = await prisma.purchaseOrder.findMany({
      include: {
        supplier: true,
        user: { select: { name: true } },
        products: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(pos);
  } catch (err) {
    next(err);
  }
});

// GET /api/purchase-orders/:id
purchaseOrdersRouter.get('/:id', async (req, res, next) => {
  try {
    const po = await prisma.purchaseOrder.findUnique({
      where: { id: parseInt(req.params.id) },
      include: {
        supplier: true,
        user: { select: { name: true } },
        products: { include: { product: true } },
        transactions: { include: { product: true, box: true } }
      },
    });
    if (!po) return res.status(404).json({ error: 'PO not found' });
    res.json(po);
  } catch (err) {
    next(err);
  }
});

// POST /api/purchase-orders — Restricted to Admin/PPIC
purchaseOrdersRouter.post('/', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { poNumber, supplierId, notes, products } = req.body;
    if (!poNumber || !supplierId || !products || products.length === 0) {
      return res.status(400).json({ error: 'PO Number, Supplier, and Products are required' });
    }

    const po = await prisma.purchaseOrder.create({
      data: {
        poNumber,
        supplierId: parseInt(supplierId),
        notes,
        userId: req.user.id,
        products: {
          create: products.map(it => ({
            productId: parseInt(it.productId),
            description: it.description || null,
            quantity: parseInt(it.quantity),
            price: it.price ? parseFloat(it.price) : null,
          })),
        },
      },
      include: { products: true },
    });

    res.status(201).json(po);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'PO Number already exists' });
    next(err);
  }
});

// POST /api/purchase-orders/:id/receive
// This is the core "Inbound" logic (receiving items to warehouse)
purchaseOrdersRouter.post('/:id/receive', requireAdminOrPPIC, validate(receivePOSchema), async (req, res, next) => {
  try {
    const poId = parseInt(req.params.id);
    const { products: receivedProducts } = req.validData; // Array of { productId, quantity, boxId, lotNumber } from Zod

    const po = await prisma.purchaseOrder.findUnique({
      where: { id: poId },
      include: { products: true },
    });

    if (!po) return res.status(404).json({ error: 'PO not found' });
    if (po.status === 'RECEIVED') return res.status(400).json({ error: 'PO already received' });

    await prisma.$transaction(async (tx) => {
      for (const rx of receivedProducts) {
        const pid = parseInt(rx.productId);
        const qty = parseInt(rx.quantity);
        const bid = parseInt(rx.boxId);
        const lot = rx.lotNumber || '';

        // Validate Box exists
        const box = await tx.box.findUnique({ where: { id: bid } });
        if (!box) throw { status: 404, message: `Box ID ${bid} tidak ditemukan.` };

        // 1. Create Transaction (IN) — logs arrival at INCOMING
        await tx.transaction.create({
          data: {
            productId: pid,
            type: 'IN',
            quantity: qty,
            userId: req.user.id,
            boxId: bid,
            purchaseOrderId: poId,
            toLocationCode: 'INCOMING',
            note: `Received from PO ${po.poNumber} → Incoming Area`,
          },
        });

        // 2. Update Global Stock
        await tx.stock.upsert({
          where: { productId: pid },
          update: { quantity: { increment: qty } },
          create: { productId: pid, quantity: qty },
        });

        // 3. Update BoxProduct (Physical Location)
        await tx.boxProduct.upsert({
          where: { boxId_productId_lotNumber: { boxId: bid, productId: pid, lotNumber: lot } },
          update: { quantity: { increment: qty } },
          create: { boxId: bid, productId: pid, quantity: qty, lotNumber: lot },
        });

        // 4. Mark Box as RECEIVED (in Incoming Area staging)
        await tx.box.update({
          where: { id: bid },
          data: { status: 'RECEIVED' },
        });
      }

      // 4. Update PO Status
      await tx.purchaseOrder.update({
        where: { id: poId },
        data: { status: 'RECEIVED' },
      });
    });

    res.json({ message: 'PO received successfully and stock updated' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/purchase-orders/:id/cancel
purchaseOrdersRouter.put('/:id/cancel', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { id } = req.params;
    const po = await prisma.purchaseOrder.findUnique({ where: { id: parseInt(id) } });

    if (!po) return res.status(404).json({ error: 'PO not found' });
    if (po.status !== 'PENDING') {
      return res.status(400).json({ error: 'Only pending orders can be cancelled' });
    }

    const updatedPo = await prisma.purchaseOrder.update({
      where: { id: parseInt(id) },
      data: { status: 'CANCELLED' },
      include: {
        supplier: true,
        user: { select: { name: true } },
        products: { include: { product: true } },
      },
    });

    res.json(updatedPo);
  } catch (err) {
    next(err);
  }
});

export default purchaseOrdersRouter;
