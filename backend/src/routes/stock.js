import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import multer from 'multer';
import ExcelJS from 'exceljs';

const upload = multer({ storage: multer.memoryStorage() });

export const stockRouter = Router();
stockRouter.use(authenticate);

// GET /api/stock — Dashboard summary and paginated inventory list
stockRouter.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 50, search = '' } = req.query;
    const p = parseInt(page);
    const l = parseInt(limit);

    const where = {};
    if (search) {
       where.product = {
          OR: [
             { name: { contains: search, mode: 'insensitive' } },
             { sku: { contains: search, mode: 'insensitive' } }
          ]
       };
    }

    // Parallel fetch for counts/summary and paginated data
    const [stocks, total, totalQty, lowStockCount, outOfStockCount] = await Promise.all([
      prisma.stock.findMany({
        where,
        include: {
          product: { 
            include: { 
              category: true, 
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
            } 
          },
        },
        orderBy: { product: { name: 'asc' } },
        skip: (p - 1) * l,
        take: l,
      }),
      prisma.stock.count({ where }),
      prisma.stock.aggregate({ _sum: { quantity: true }, where }),
      prisma.stock.count({ 
        where: { 
          ...where,
          quantity: { gt: 0, lte: 10 } // simplified low stock check or use specific field
        } 
      }),
      prisma.stock.count({ where: { ...where, quantity: 0 } })
    ]);

    // Format location strings for frontend (only for the paginated subset)
    const stocksWithPath = stocks.map(s => {
      const locations = s.product.boxProducts.map(bp => {
        const p = bp.box.pallet;
        if (!p) return `Box: ${bp.box.name}`;
        const l = p.rackLevel;
        const sec = l.section;
        const r = sec.rack;
        const f = r.floor;
        return `${f.name} > Rak ${r.letter}${sec.number} > L${l.number} > ${bp.box.name}`;
      });
      return { 
        ...s, 
        locationPath: locations.length > 0 ? locations[0] : (locations.length > 1 ? `${locations[0]} (+${locations.length - 1} more)` : 'Belum Ada Lokasi') 
      };
    });

    res.json({ 
      summary: { 
        total, 
        lowStock: lowStockCount, 
        outOfStock: outOfStockCount, 
        totalQty: totalQty._sum.quantity || 0 
      }, 
      stocks: stocksWithPath,
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

// POST /api/stock/import-odoo — Import from Odoo Excel
stockRouter.post('/import-odoo', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Tidak ada file yang diunggah' });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(req.file.buffer);
    const worksheet = workbook.getWorksheet(1);

    const stats = { created: 0, updated: 0, skipped: 0, errors: [] };

    // Column Mapping: Location, Product, Lot, Inventoried Qty, Reserved Qty, UoM
    // We assume columns are in order or we find them by header
    let colMap = { location: 1, product: 2, lot: 3, invQty: 4, resQty: 5, uom: 6 };

    // Find headers
    const headerRow = worksheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const val = cell.value?.toString().toLowerCase();
      if (val?.includes('location')) colMap.location = colNumber;
      if (val?.includes('product')) colMap.product = colNumber;
      if (val?.includes('lot') || val?.includes('serial')) colMap.lot = colNumber;
      if (val?.includes('inventoried')) colMap.invQty = colNumber;
      if (val?.includes('reserved')) colMap.resQty = colNumber;
      if (val?.includes('unit')) colMap.uom = colNumber;
    });

    // Start from row 2
    for (let i = 2; i <= worksheet.rowCount; i++) {
      const row = worksheet.getRow(i);
      const locStr = row.getCell(colMap.location).value?.toString() || '';
      const prodStr = row.getCell(colMap.product).value?.toString() || '';
      const lotStr = row.getCell(colMap.lot).value?.toString() || null;
      const invQty = parseInt(row.getCell(colMap.invQty).value) || 0;
      const resQty = parseInt(row.getCell(colMap.resQty).value) || 0;
      const unit = row.getCell(colMap.uom).value?.toString() || 'pcs';

      if (!prodStr) continue;

      try {
      // 1. Parse SKU/Name: [SKU] Name
        let sku = prodStr;
        let name = prodStr;
        const match = prodStr.match(/\[(.*?)\]\s*(.*)/);
        if (match) {
          sku = match[1].trim();
          name = match[2].trim();
        }

        // Use empty string for null lot numbers to satisfy unique constraint stability (if needed later)
        const finalLot = lotStr || '';

        await prisma.$transaction(async (tx) => {
          // 2. Find/Create Product
          let product = await tx.product.findUnique({ where: { sku } });
          if (!product) {
            product = await tx.product.create({
              data: { sku, name, unit, description: 'Imported from Odoo' }
            });
            await tx.stock.create({ data: { productId: product.id, quantity: invQty, reservedQuantity: resQty } });
            stats.created++;
          } else {
            // 3. Update Global Stock directly (Since user wants manual location assignment later)
            // We set the total stock to match Odoo's total for this product
            await tx.stock.update({
              where: { productId: product.id },
              data: { 
                quantity: { increment: invQty }, // Or set it directly if the excel is the source of truth
                reservedQuantity: { increment: resQty }
              }
            });
          }
        });

        stats.updated++;
      } catch (err) {
        stats.errors.push({ row: i, product: prodStr, error: err.message });
      }
    }

    res.json({ message: 'Import selesai', stats });
  } catch (err) {
    next(err);
  }
});
