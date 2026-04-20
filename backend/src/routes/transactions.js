import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { validate, transactionSchema } from '../validations/wms.js';

export const transactionsRouter = Router();
transactionsRouter.use(authenticate);

// GET /api/transactions — List with filters
transactionsRouter.get('/', async (req, res, next) => {
  try {
    const { type, productId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};

    if (type) where.type = type;
    if (productId) where.productId = parseInt(productId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, role: true } },
        },
        orderBy: { date: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit),
      }),
      prisma.transaction.count({ where }),
    ]);

    res.json({ transactions, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) });
  } catch (err) {
    next(err);
  }
});

// POST /api/transactions — Create transaction (IN/OUT/ADJUST)
transactionsRouter.post('/', validate(transactionSchema), async (req, res, next) => {
  try {
    const { productId, type, quantity, referenceNo, note, boxId, targetBoxId, lotNumber } = req.validData;

    const result = await prisma.$transaction(async (tx) => {
      const pid = productId;
      
      const stock = await tx.stock.findUnique({ where: { productId: pid } });
      if (!stock) throw { status: 404, message: 'Product stock record not found' };

      let globalDelta = 0;

      // 1. Handle MOVE specially
      if (type === 'MOVE') {
        const sourceId = boxId;
        const destId = targetBoxId;

        // Atomic Decrease from source
        const sourceBi = await tx.boxProduct.update({
          where: { boxId_productId_lotNumber: { boxId: sourceId, productId: pid, lotNumber } },
          data: { quantity: { decrement: quantity } }
        }).catch(() => { throw { status: 400, message: 'Produk tidak ditemukan di box asal.' }; });

        if (sourceBi.quantity < 0) {
          throw { status: 400, message: `Stok di box asal tidak cukup. Tersedia: ${sourceBi.quantity + quantity}` };
        }

        // Atomic Increase in target (Upsert pattern)
        await tx.boxProduct.upsert({
          where: { boxId_productId_lotNumber: { boxId: destId, productId: pid, lotNumber } },
          update: { quantity: { increment: quantity } },
          create: { boxId: destId, productId: pid, quantity: quantity, lotNumber }
        });

        globalDelta = 0; // Global stock doesn't change on MOVE
      } else if (boxId) {
        // 2. Handle Box Level (IN/OUT/ADJUST)
        const bid = boxId;

        if (type === 'IN') {
          globalDelta = quantity;
          await tx.boxProduct.upsert({
            where: { boxId_productId_lotNumber: { boxId: bid, productId: pid, lotNumber } },
            update: { quantity: { increment: quantity } },
            create: { boxId: bid, productId: pid, quantity: quantity, lotNumber }
          });

        } else if (type === 'OUT') {
          globalDelta = -quantity;
          const boxItem = await tx.boxProduct.update({
            where: { boxId_productId_lotNumber: { boxId: bid, productId: pid, lotNumber } },
            data: { quantity: { decrement: quantity } }
          }).catch(() => { throw { status: 400, message: 'Produk tidak ditemukan di cell.' }; });

          if (boxItem.quantity < 0) {
            throw { status: 400, message: `Stok di cell kurang. Tersedia: ${boxItem.quantity + quantity}` };
          }
        } else {
          // ADJUST
          const boxProduct = await tx.boxProduct.findUnique({
             where: { boxId_productId_lotNumber: { boxId: bid, productId: pid, lotNumber } }
          });
          const oldBoxQty = boxProduct ? boxProduct.quantity : 0;
          globalDelta = quantity - oldBoxQty;

          await tx.boxProduct.upsert({
            where: { boxId_productId_lotNumber: { boxId: bid, productId: pid, lotNumber } },
            update: { quantity: quantity },
            create: { boxId: bid, productId: pid, quantity: quantity, lotNumber }
          });
        }
      } else if (type === 'ADJUST') {
        // 3. Special Case: Global-only ADJUST for Syncing
        globalDelta = quantity - stock.quantity;
      } else {
        // 4. Reject global-only IN/OUT as per user request
        throw { status: 400, message: 'Transaksi IN/OUT wajib memilik target Box penyimpanan agar data stok sinkron.' };
      }

      // 4. Update Global Stock (only if globalDelta != 0)
      let finalGlobalQty = stock.quantity;
      if (globalDelta !== 0) {
        const updatedStock = await tx.stock.update({
          where: { productId: pid },
          data: { quantity: { increment: globalDelta } }
        });
        finalGlobalQty = updatedStock.quantity;

        if (finalGlobalQty < 0) throw { status: 400, message: 'Transaksi ini akan mengakibatkan stok negatif di pusat.' };
      }

      // 5. Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          productId: pid,
          type,
          quantity: quantity,
          referenceNo,
          boxId: boxId ? boxId : null,
          note: type === 'MOVE' ? `${note || ''} (Pindah ke Box ID ${targetBoxId})`.trim() : note,
          userId: req.user.id,
        },
        include: {
          product: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, role: true } },
        },
      });

      return { transaction, newStock: finalGlobalQty };
    });

    res.status(201).json(result);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// GET /api/transactions/export — Excel export
transactionsRouter.get('/export', async (req, res, next) => {
  try {
    const { startDate, endDate, type } = req.query;
    const where = {};
    if (type) where.type = type;
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const transactions = await prisma.transaction.findMany({
      where,
      include: {
        product: { select: { name: true, sku: true, unit: true } },
        user: { select: { name: true } },
      },
      orderBy: { date: 'desc' },
    });

    // Dynamic import exceljs
    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Warehouse Inventory System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Transaction History', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Header styling
    sheet.mergeCells('A1:H1');
    sheet.getCell('A1').value = 'WAREHOUSE INVENTORY — TRANSACTION HISTORY';
    sheet.getCell('A1').font = { bold: true, size: 14, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0f1629' } };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    if (startDate || endDate) {
      sheet.mergeCells('A2:H2');
      sheet.getCell('A2').value = `Period: ${startDate || 'All'} — ${endDate || 'All'}`;
      sheet.getCell('A2').alignment = { horizontal: 'center' };
      sheet.getCell('A2').font = { italic: true };
    }

    const headerRow = sheet.addRow(['No', 'Date', 'SKU', 'Product Name', 'Type', 'Quantity', 'Unit', 'Reference No', 'User', 'Note']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
      cell.alignment = { horizontal: 'center' };
    });

    sheet.columns = [
      { width: 5 }, { width: 20 }, { width: 15 }, { width: 30 },
      { width: 10 }, { width: 10 }, { width: 8 }, { width: 20 },
      { width: 15 }, { width: 30 },
    ];

    transactions.forEach((t, i) => {
      const row = sheet.addRow([
        i + 1,
        new Date(t.date).toLocaleString('id-ID'),
        t.product.sku,
        t.product.name,
        t.type,
        t.quantity,
        t.product.unit,
        t.referenceNo || '-',
        t.user.name,
        t.note || '-',
      ]);

      // Color code type
      const typeCell = row.getCell(5);
      if (t.type === 'IN') typeCell.font = { color: { argb: 'FF10b981' }, bold: true };
      else if (t.type === 'OUT') typeCell.font = { color: { argb: 'FFf43f5e' }, bold: true };
      else typeCell.font = { color: { argb: 'FFf59e0b' }, bold: true };

      if (i % 2 === 0) {
        row.eachCell((cell) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        });
      }
    });

    // Total row
    sheet.addRow([]);
    const totalRow = sheet.addRow(['', '', '', 'TOTAL TRANSACTIONS:', transactions.length]);
    totalRow.getCell(4).font = { bold: true };
    totalRow.getCell(5).font = { bold: true };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="transactions-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

export default transactionsRouter;
