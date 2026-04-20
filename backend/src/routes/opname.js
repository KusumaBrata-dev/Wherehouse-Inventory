import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireAdminOrPPIC } from '../middleware/auth.js';

export const opnameRouter = Router();
opnameRouter.use(authenticate);

/**
 * GET /api/opname/location/:code
 * Returns all inventory at a given location code (e.g. L1-A-03-02 or INCOMING)
 * Used by Stock Opname flow to show what the system expects
 */
opnameRouter.get('/location/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    const level = await prisma.rackLevel.findUnique({
      where: { code: code.toUpperCase() },
      include: {
        section: { include: { rack: { include: { floor: true } } } },
        pallets: {
          include: {
            boxes: {
              include: {
                boxProducts: { include: { product: true } }
              }
            }
          }
        }
      }
    });

    if (!level) {
      return res.status(404).json({ error: `Lokasi "${code}" tidak ditemukan.` });
    }

    // Aggregate by product
    const productMap = {};
    level.pallets.forEach(pallet => {
      pallet.boxes.forEach(box => {
        box.boxProducts.forEach(bp => {
          const key = `${bp.productId}-${bp.boxId}`;
          if (!productMap[key]) {
            productMap[key] = {
              productId: bp.product.id,
              sku: bp.product.sku,
              name: bp.product.name,
              unit: bp.product.unit,
              palletCode: pallet.code,
              boxId: bp.boxId,
              systemQty: 0,
              actualQty: null // to be filled by operator
            };
          }
          productMap[key].systemQty += bp.quantity;
        });
      });
    });

    res.json({
      locationCode: level.code,
      locationId: level.id,
      path: `${level.section.rack.floor.name} > Rak ${level.section.rack.letter} > Baris ${level.section.number} > Level ${level.number}`,
      palletCount: level.pallets.length,
      items: Object.values(productMap)
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/opname/adjust
 * Batch stock adjustment after physical count
 * Body: { locationCode, userId (from jwt), items: [{ productId, boxId, systemQty, actualQty }] }
 * Creates ADJUST transactions for any discrepancies
 * Restricted to ADMIN/PPIC
 */
opnameRouter.post('/adjust', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { locationCode, items } = req.body;
    if (!locationCode || !Array.isArray(items)) {
      return res.status(400).json({ error: 'locationCode dan items[] wajib diisi.' });
    }

    const adjustments = items.filter(item =>
      item.actualQty !== null &&
      item.actualQty !== undefined &&
      parseInt(item.actualQty) !== parseInt(item.systemQty)
    );

    if (adjustments.length === 0) {
      return res.json({ message: 'Tidak ada selisih — stok sudah sesuai.', transactions: [] });
    }

    const created = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const item of adjustments) {
        const actualQty = parseInt(item.actualQty);
        const systemQty = parseInt(item.systemQty);
        const diff = actualQty - systemQty;

        // Update BoxProduct quantity
        await tx.boxProduct.updateMany({
          where: { boxId: parseInt(item.boxId), productId: parseInt(item.productId) },
          data: { quantity: actualQty }
        });

        // Update global Stock
        await tx.stock.updateMany({
          where: { productId: parseInt(item.productId) },
          data: { quantity: { increment: diff } }
        });

        // Log ADJUST transaction
        const trx = await tx.transaction.create({
          data: {
            type: 'ADJUST',
            productId: parseInt(item.productId),
            quantity: actualQty,
            note: `Stock Opname @ ${locationCode} | Sistem: ${systemQty} → Aktual: ${actualQty} (Selisih: ${diff >= 0 ? '+' : ''}${diff})`,
            fromLocationCode: locationCode,
            userId: req.user.id
          }
        });
        results.push(trx);
      }

      return results;
    });

    res.json({
      message: `${created.length} adjustment berhasil dicatat.`,
      transactions: created
    });
  } catch (err) {
    next(err);
  }
});
