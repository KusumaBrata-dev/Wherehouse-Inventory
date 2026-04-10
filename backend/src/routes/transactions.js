import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const transactionsRouter = Router();
transactionsRouter.use(authenticate);

// GET /api/transactions — List with filters
transactionsRouter.get('/', async (req, res, next) => {
  try {
    const { type, itemId, startDate, endDate, page = 1, limit = 50 } = req.query;
    const where = {};

    if (type) where.type = type;
    if (itemId) where.itemId = parseInt(itemId);
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate + 'T23:59:59.999Z');
    }

    const [transactions, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        include: {
          item: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, role: true } },
          supplier: { select: { id: true, name: true } },
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
transactionsRouter.post('/', async (req, res, next) => {
  try {
    const { itemId, type, quantity, referenceNo, supplierId, note } = req.body;
    if (!itemId || !type || !quantity) {
      return res.status(400).json({ error: 'itemId, type, and quantity are required' });
    }
    if (!['IN', 'OUT', 'ADJUST'].includes(type)) {
      return res.status(400).json({ error: 'type must be IN, OUT, or ADJUST' });
    }
    const qty = parseInt(quantity);
    if (qty <= 0) return res.status(400).json({ error: 'quantity must be positive' });

    const result = await prisma.$transaction(async (tx) => {
      // Get current stock
      const stock = await tx.stock.findUnique({ where: { itemId: parseInt(itemId) } });
      if (!stock) throw { status: 404, message: 'Item stock record not found' };

      let newQty;
      if (type === 'IN') newQty = stock.quantity + qty;
      else if (type === 'OUT') {
        if (stock.quantity < qty) throw { status: 400, message: `Insufficient stock. Available: ${stock.quantity}` };
        newQty = stock.quantity - qty;
      } else {
        // ADJUST — set to absolute value
        newQty = qty;
      }

      // Update stock
      await tx.stock.update({ where: { itemId: parseInt(itemId) }, data: { quantity: newQty } });

      // Create transaction record
      const transaction = await tx.transaction.create({
        data: {
          itemId: parseInt(itemId),
          type,
          quantity: qty,
          referenceNo,
          supplierId: supplierId ? parseInt(supplierId) : null,
          userId: req.user.id,
          note,
        },
        include: {
          item: { select: { id: true, name: true, sku: true, unit: true } },
          user: { select: { id: true, name: true, role: true } },
        },
      });

      return { transaction, newStock: newQty };
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
        item: { select: { name: true, sku: true, unit: true } },
        user: { select: { name: true } },
        supplier: { select: { name: true } },
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

    const headerRow = sheet.addRow(['No', 'Date', 'SKU', 'Item Name', 'Type', 'Quantity', 'Unit', 'Reference No', 'Supplier', 'User', 'Note']);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3b82f6' } };
      cell.alignment = { horizontal: 'center' };
    });

    sheet.columns = [
      { width: 5 }, { width: 20 }, { width: 15 }, { width: 30 },
      { width: 10 }, { width: 10 }, { width: 8 }, { width: 20 },
      { width: 20 }, { width: 15 }, { width: 30 },
    ];

    transactions.forEach((t, i) => {
      const row = sheet.addRow([
        i + 1,
        new Date(t.date).toLocaleString('id-ID'),
        t.item.sku,
        t.item.name,
        t.type,
        t.quantity,
        t.item.unit,
        t.referenceNo || '-',
        t.supplier?.name || '-',
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
