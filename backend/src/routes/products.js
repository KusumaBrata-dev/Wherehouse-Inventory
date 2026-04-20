import { Router } from 'express';
import QRCode from 'qrcode';
import { createCanvas } from 'canvas';
import JsBarcode from 'jsbarcode';
import prisma from '../lib/prisma.js';
import { authenticate, requireAdminOrPPIC } from '../middleware/auth.js';

export const productsRouter = Router();

// ── Public endpoints (no auth needed — browser loads img tags) ────────────

// GET /api/products/:id/qr — Generate QR code image (PNG)
productsRouter.get('/:id/qr', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const qrData = JSON.stringify({ sku: product.sku, name: product.name });
    const qrBuffer = await QRCode.toBuffer(qrData, {
      errorCorrectionLevel: 'H',
      width: 300,
      margin: 2,
      color: { dark: '#0f1629', light: '#ffffff' },
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="qr-${product.sku}.png"`);
    res.send(qrBuffer);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id/barcode — Generate Barcode image (PNG)
productsRouter.get('/:id/barcode', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: parseInt(req.params.id) } });
    if (!product) return res.status(404).json({ error: 'Product not found' });

    const canvas = createCanvas(400, 150);
    JsBarcode(canvas, product.sku, {
      format: 'CODE128',
      width: 2,
      height: 100,
      displayValue: true,
      text: `${product.sku} | ${product.name}`,
      textMargin: 5,
      fontSize: 14,
      background: '#ffffff',
      lineColor: '#0f1629',
    });

    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="barcode-${product.sku}.png"`);
    canvas.createPNGStream().pipe(res);
  } catch (err) {
    next(err);
  }
});

// GET /api/products/export/excel — Export products to Excel with embedded QR Codes
productsRouter.get('/export/excel', async (req, res, next) => {
  try {
    const products = await prisma.product.findMany({
      include: { category: true, stock: true },
      orderBy: { name: 'asc' },
    });

    const { default: ExcelJS } = await import('exceljs');
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Master Products & QR Codes', {
      pageSetup: { paperSize: 9, orientation: 'landscape' },
    });

    // Styling & Header
    sheet.mergeCells('A1:G1');
    sheet.getCell('A1').value = 'MASTER PRODUCT LIST WITH QR CODES';
    sheet.getCell('A1').font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
    sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F1629' } };
    sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    sheet.getRow(1).height = 40;

    const headers = ['NO', 'SKU', 'PRODUCT NAME', 'CATEGORY', 'UNIT', 'STOCK', 'QR CODE'];
    sheet.addRow(headers).eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3F4F6' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = {
        top: { style: 'thin' }, bottom: { style: 'thin' },
        left: { style: 'thin' }, right: { style: 'thin' }
      };
    });

    sheet.columns = [
      { width: 5 }, { width: 15 }, { width: 35 }, { width: 15 },
      { width: 10 }, { width: 10 }, { width: 20 },
    ];

    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      const rowNum = i + 3;
      
      const row = sheet.addRow([
        i + 1,
        product.sku,
        product.name,
        product.category?.name || '-',
        product.unit,
        product.stock?.quantity || 0,
        '' // Placeholder for image
      ]);
      row.height = 100; // Make row tall enough for QR code
      
      row.eachCell((cell) => {
        cell.alignment = { vertical: 'middle', wrapText: true };
        cell.border = {
          top: { style: 'thin' }, bottom: { style: 'thin' },
          left: { style: 'thin' }, right: { style: 'thin' }
        };
      });

      // Generate QR Code Buffer
      const qrData = JSON.stringify({ sku: product.sku, name: product.name });
      const qrBuffer = await QRCode.toBuffer(qrData, {
        errorCorrectionLevel: 'M',
        width: 150,
        margin: 1,
      });

      // Add image to workbook and sheet
      const imageId = workbook.addImage({
        buffer: qrBuffer,
        extension: 'png',
      });
      
      sheet.addImage(imageId, {
        tl: { col: 6.1, row: rowNum - 1 + 0.1 },
        ext: { width: 100, height: 100 }
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="master-products-qr-${Date.now()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
});

// ── Auth-protected routes ─────────────────────────────────────────────────
productsRouter.use(authenticate);

// GET /api/products — List all products with stock (Optimized for large data)
productsRouter.get('/', async (req, res, next) => {
  try {
    const { search, category, lowStock, page = 1, limit = 50 } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);
    
    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (category) where.categoryId = parseInt(category);

    // Filter low stock (Note: Complex comparison quantity <= minStock is handled after fetch or via raw query)
    if (lowStock === 'true') {
      // For large-scale data, we recommend a raw query or a computed column.
      // Temporarily disabled to prevent crash.
    }

    // Products inside a Box (prefix PART-) are hidden from Master Product list unless searched
    if (!search) {
      where.NOT = { sku: { startsWith: 'PART-' } };
    }

    // Fetch Count & Data in parallel
    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          category: true,
          stock: true,
          rackLocations: true,
        },
        orderBy: { name: 'asc' },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.product.count({ where })
    ]);

    // Handle the low stock column comparison in-memory for now if it's too complex for Prisma where, 
    // BUT we must keep pagination. Best is to handle basic filters at DB level.
    // If user really needs 'lowStock' for 50k items, we'll need a specialized view or cached boolean.
    // For now, let's keep it functional with pagination.

    res.json({
      products,
      pagination: {
        total,
        page: p,
        limit: l,
        totalPages: Math.ceil(total / l)
      }
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/products/:id
productsRouter.get('/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { 
        category: true, 
        stock: true, 
        rackLocations: true,
        boxProducts: {
          include: {
            box: {
              include: {
                pallet: {
                  include: {
                    rackLevel: {
                      include: {
                        section: {
                          include: {
                            rack: {
                              include: { floor: true }
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      },
    });
    if (!product) return res.status(404).json({ error: 'Product not found' });
    res.json(product);
  } catch (err) {
    next(err);
  }
});

// POST /api/products — Create product
productsRouter.post('/', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { name, sku, categoryId, unit, description, minStock } = req.body;
    if (!name || !sku || !unit) {
      return res.status(400).json({ error: 'name, sku, and unit are required' });
    }

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { name, sku, categoryId: categoryId ? parseInt(categoryId) : null, unit, description, minStock: minStock ? parseInt(minStock) : 0 },
      });
      // Auto-create stock record with 0 quantity
      await tx.stock.create({ data: { productId: created.id, quantity: 0 } });
      return created;
    });

    const full = await prisma.product.findUnique({
      where: { id: product.id },
      include: { category: true, stock: true, rackLocations: true },
    });
    res.status(201).json(full);
  } catch (err) {
    if (err.code === 'P2002') return res.status(409).json({ error: 'SKU already exists' });
    next(err);
  }
});

// PUT /api/products/:id — Update product
productsRouter.put('/:id', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { name, sku, categoryId, unit, description, minStock } = req.body;
    const product = await prisma.product.update({
      where: { id: parseInt(req.params.id) },
      data: { name, sku, categoryId: categoryId ? parseInt(categoryId) : null, unit, description, minStock: minStock ? parseInt(minStock) : 0 },
      include: { category: true, stock: true, rackLocations: true },
    });
    res.json(product);
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    if (err.code === 'P2002') return res.status(409).json({ error: 'SKU already exists' });
    next(err);
  }
});

// DELETE /api/products/:id
productsRouter.delete('/:id', requireAdminOrPPIC, async (req, res, next) => {
  try {
    await prisma.product.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Product deleted successfully' });
  } catch (err) {
    if (err.code === 'P2025') return res.status(404).json({ error: 'Product not found' });
    next(err);
  }
});
