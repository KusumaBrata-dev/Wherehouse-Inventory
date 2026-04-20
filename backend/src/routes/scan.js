import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

export const scanRouter = Router();
scanRouter.use(authenticate);

// Helper to format full hierarchical name
async function getFullPath(rackLevelId) {
  const level = await prisma.rackLevel.findUnique({
    where: { id: rackLevelId },
    include: {
      section: {
        include: {
          rack: {
            include: { floor: true }
          }
        }
      }
    }
  });

  if (!level) return null;

  const floorName = level.section.rack.floor.name;
  const rackLetter = level.section.rack.letter;
  const sectionNum = level.section.number;
  const levelNum = level.number;

  return {
    floor: floorName,
    rack: rackLetter,
    section: sectionNum,
    level: levelNum,
    fullCode: `${rackLetter}${sectionNum}-LVL${levelNum}`,
    fullPath: `${floorName} > Rak ${rackLetter} > Baris ${rackLetter}${sectionNum} > Level ${levelNum}`
  };
}

// Helper to build level response (used by both resolvers)
async function buildLevelResponse(level) {
  const pallets = await prisma.pallet.findMany({
    where: { rackLevelId: level.id },
    include: {
      boxes: {
        include: { boxProducts: { include: { product: true } } }
      }
    }
  });

  // Aggregate products across all boxes
  const productMap = {};
  pallets.forEach(p => {
    p.boxes.forEach(b => {
      b.boxProducts.forEach(bp => {
        if (!productMap[bp.productId]) {
          productMap[bp.productId] = {
            productId: bp.product.id,
            name: bp.product.name,
            sku: bp.product.sku,
            unit: bp.product.unit,
            quantity: 0
          };
        }
        productMap[bp.productId].quantity += bp.quantity;
      });
    });
  });

  return {
    type: 'level',
    id: level.id,
    code: level.code,
    number: level.number,
    section: level.section,
    floorName: level.section.rack.floor.name,
    palletCount: pallets.length,
    totalBoxes: pallets.reduce((acc, p) => acc + p.boxes.length, 0),
    pallets: pallets.map(p => ({
      id: p.id, code: p.code, name: p.name, boxCount: p.boxes.length
    })),
    products: Object.values(productMap)
  };
}

async function buildColumnResponse(section) {
  const levels = await prisma.rackLevel.findMany({
    where: { sectionId: section.id },
    orderBy: { number: 'asc' },
    include: { pallets: true }
  });

  return {
    type: 'column',
    id: section.id,
    code: section.code,
    rackLetter: section.rack.letter,
    columnNumber: section.number,
    floorName: section.rack.floor.name,
    levels: levels.map(l => ({
      id: l.id,
      number: l.number,
      levelCode: l.code,
      palletCount: l.pallets.length,
      isEmpty: l.pallets.length === 0
    })),
    totalPallets: levels.reduce((acc, l) => acc + l.pallets.length, 0)
  };
}

async function buildRackResponse(rack) {
  const sections = await prisma.section.findMany({
    where: { rackId: rack.id },
    orderBy: { number: 'asc' },
    include: { levels: { include: { pallets: true } } }
  });

  let totalPallets = 0;
  const columns = sections.map(s => {
    const levels = s.levels.map(l => {
      totalPallets += l.pallets.length;
      return {
        id: l.id,
        number: l.number,
        levelCode: l.code,
        palletCount: l.pallets.length,
        isEmpty: l.pallets.length === 0
      };
    }).sort((a, b) => a.number - b.number);
    return {
      id: s.id,
      number: s.number,
      code: s.code,
      levels
    };
  });

  return {
    type: 'rack',
    id: rack.id,
    letter: rack.letter,
    floorName: rack.floor.name,
    columns,
    totalPallets
  };
}

// GET /api/scan/:code — Lookup product, box, pallet, or location by code
scanRouter.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    let scanType = null;
    let scanCode = code.toUpperCase();
    if (scanCode.includes('|')) {
      const parts = scanCode.split('|');
      scanType = parts[0];
      scanCode = parts.slice(1).join('|');
    }

    // 0a. Try parsing as LEVEL
    if (scanType === 'LEVEL' || (!scanType && scanCode.split('-').length === 4)) {
      const level = await prisma.rackLevel.findUnique({
        where: { code: scanCode },
        include: { section: { include: { rack: { include: { floor: true } } } } }
      });
      if (level) return res.json(await buildLevelResponse(level));
    }

    // 0b. Try parsing as COLUMN
    if (scanType === 'COLUMN' || (!scanType && scanCode.split('-').length === 3)) {
      const section = await prisma.section.findUnique({
        where: { code: scanCode },
        include: { rack: { include: { floor: true } }, levels: true }
      });
      if (section) return res.json(await buildColumnResponse(section));
    }

    // 0c. Try parsing as RACK
    if (scanType === 'RACK' || (!scanType && scanCode.split('-').length === 2)) {
      const section = await prisma.section.findFirst({
        where: { code: { startsWith: scanCode + '-' } },
        include: { rack: { include: { floor: true } } }
      });
      if (section && section.rack) return res.json(await buildRackResponse(section.rack));
    }

    // 0d. Fallback exact match (e.g., INCOMING)
    const levelByCode = await prisma.rackLevel.findUnique({
      where: { code: scanCode },
      include: {
        section: { include: { rack: { include: { floor: true } } } }
      }
    });
    if (levelByCode) {
      return res.json(await buildLevelResponse(levelByCode));
    }

    // 1. Try finding a Product
    const product = await prisma.product.findUnique({
      where: { sku: code },
      include: {
        category: true,
        stock: true,
        rackLocations: { orderBy: { rackCode: 'asc' } },
        boxProducts: {
          include: {
            box: {
              include: {
                pallet: {
                  include: {
                    rackLevel: {
                      include: {
                        section: { include: { rack: { include: { floor: true } } } }
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

    if (product) {
      return res.json({
        type: 'product',
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        category: product.category?.name || null,
        quantity: product.stock?.quantity ?? 0,
        minStock: product.minStock,
        isLowStock: (product.stock?.quantity ?? 0) <= product.minStock,
        rackLocations: product.rackLocations,
        primaryRack: product.rackLocations[0]?.rackCode || null,
        boxes: product.boxProducts.map(bp => ({
          id: bp.boxId,
          code: bp.box.code,
          name: bp.box.name,
          quantity: bp.quantity,
          path: `${bp.box.pallet?.rackLevel.section.rack.floor.name} > ${bp.box.pallet?.rackLevel.section.rack.letter}${bp.box.pallet?.rackLevel.section.number}-L${bp.box.pallet?.rackLevel.number}`
        }))
      });
    }

    // 2. Try finding a Box by its human code
    const box = await prisma.box.findUnique({
      where: { code },
      include: {
        pallet: {
          include: { 
            rackLevel: {
              include: {
                section: {
                  include: {
                    rack: { include: { floor: true } }
                  }
                }
              }
            }
          }
        },
        boxProducts: {
          include: { product: true }
        }
      }
    });

    if (box) {
      const pathInfo = await getFullPath(box.pallet?.rackLevelId);
      return res.json({
        type: 'box',
        id: box.id,
        code: box.code,
        name: box.name,
        location: pathInfo,
        palletCode: box.pallet?.code,
        products: box.boxProducts.map(bp => ({
          productId: bp.product.id,
          sku: bp.product.sku,
          name: bp.product.name,
          unit: bp.product.unit,
          quantity: bp.quantity
        }))
      });
    }

    // 3. Try finding a Pallet by its human code
    const pallet = await prisma.pallet.findUnique({
      where: { code },
      include: {
        rackLevel: {
          include: {
            section: {
              include: {
                rack: { include: { floor: true } }
              }
            }
          }
        },
        boxes: {
          include: { boxProducts: { include: { product: true } } }
        }
      }
    });

    if (pallet) {
      const productMap = {};
      pallet.boxes.forEach(box => {
        box.boxProducts.forEach(bp => {
          if (!productMap[bp.productId]) {
            productMap[bp.productId] = { productId: bp.product.id, name: bp.product.name, sku: bp.product.sku, unit: bp.product.unit, quantity: 0 };
          }
          productMap[bp.productId].quantity += bp.quantity;
        });
      });

      const pathInfo = await getFullPath(pallet.rackLevelId);
      return res.json({
        type: 'pallet',
        id: pallet.id,
        code: pallet.code,
        name: pallet.name,
        location: pathInfo,
        products: Object.values(productMap),
        boxes: pallet.boxes.map(b => ({
          id: b.id,
          code: b.code,
          name: b.name,
          totalProducts: b.boxProducts.length
        }))
      });
    }

    // 4. Try finding synthetic Location codes (LOC:TYPE:ID)
    if (code.startsWith('LOC:')) {
      const [, type, id] = code.split(':');
      const numericId = parseInt(id);

      if (type === 'FLR') {
        const f = await prisma.floor.findUnique({ where: { id: numericId } });
        if (f) return res.json({ type: 'floor', id: f.id, name: f.name });
      } else if (type === 'RCK') {
        const r = await prisma.rack.findUnique({ 
          where: { id: numericId }, 
          include: { 
            floor: true,
            sections: {
              include: {
                levels: {
                  include: {
                    pallets: {
                      include: {
                        boxes: true
                      }
                    }
                  }
                }
              }
            }
          } 
        });
        if (r) {
          const pallets = [];
          let totalBoxes = 0;
          r.sections.forEach(s => {
            s.levels.forEach(l => {
              l.pallets.forEach(p => {
                pallets.push({ id: p.id, code: p.code, name: p.name, boxCount: p.boxes.length, level: l.number, section: s.number });
                totalBoxes += p.boxes.length;
              });
            });
          });
          return res.json({ 
            type: 'rack', 
            id: r.id, 
            letter: r.letter, 
            floorName: r.floor.name,
            sectionCount: r.sections.length,
            palletCount: pallets.length,
            totalBoxes,
            pallets 
          });
        }
      } else if (type === 'SEC') {
        const s = await prisma.section.findUnique({ 
          where: { id: numericId }, 
          include: { 
            rack: { include: { floor: true } },
            levels: {
              include: {
                pallets: {
                  include: {
                    boxes: true
                  }
                }
              }
            }
          } 
        });
        if (s) {
          const pallets = [];
          let totalBoxes = 0;
          s.levels.forEach(l => {
            l.pallets.forEach(p => {
              pallets.push({ id: p.id, code: p.code, name: p.name, boxCount: p.boxes.length, level: l.number });
              totalBoxes += p.boxes.length;
            });
          });
          return res.json({ 
            type: 'section', 
            id: s.id, 
            number: s.number, 
            rackLetter: s.rack.letter,
            floorName: s.rack.floor.name,
            palletCount: pallets.length,
            totalBoxes,
            pallets 
          });
        }
      } else if (type === 'LVL') {
        const l = await prisma.rackLevel.findUnique({ 
          where: { id: numericId }, 
          include: { 
            section: { include: { rack: { include: { floor: true } } } },
            pallets: { include: { boxes: true } }
          } 
        });
        if (l) {
          const totalBoxes = l.pallets.reduce((acc, p) => acc + p.boxes.length, 0);
          return res.json({ 
            type: 'level', 
            id: l.id, 
            number: l.number, 
            section: l.section,
            floorName: l.section.rack.floor.name,
            palletCount: l.pallets.length,
            totalBoxes,
            pallets: l.pallets.map(p => ({
              id: p.id, code: p.code, name: p.name, boxCount: p.boxes.length
            }))
          });
        }
      } else if (type === 'PAL') {
        const p = await prisma.pallet.findUnique({ 
          where: { id: numericId }, 
          include: { 
            rackLevel: { include: { section: { include: { rack: { include: { floor: true } } } } } },
            boxes: { include: { boxProducts: { include: { product: true } } } }
          } 
        });
        if (p) {
          const productMap = {};
          p.boxes.forEach(box => {
            box.boxProducts.forEach(bp => {
              if (!productMap[bp.productId]) {
                productMap[bp.productId] = { productId: bp.product.id, name: bp.product.name, sku: bp.product.sku, unit: bp.product.unit, quantity: 0 };
              }
              productMap[bp.productId].quantity += bp.quantity;
            });
          });
          return res.json({ 
            type: 'pallet', id: p.id, name: p.name, code: p.code,
            location: await getFullPath(p.rackLevelId),
            products: Object.values(productMap),
            boxes: p.boxes.map(b => ({ id: b.id, code: b.code, name: b.name, totalProducts: b.boxProducts.length }))
          });
        }
      } else if (type === 'BOX') {
        const b = await prisma.box.findUnique({ 
          where: { id: numericId }, 
          include: { 
            pallet: { include: { rackLevel: { include: { section: { include: { rack: { include: { floor: true } } } } } } } },
            boxProducts: { include: { product: true } }
          } 
        });
        if (b) return res.json({ 
          type: 'box', id: b.id, name: b.name, code: b.code,
          location: await getFullPath(b.pallet?.rackLevelId),
          products: b.boxProducts.map(bp => ({ productId: bp.product.id, name: bp.product.name, sku: bp.product.sku, unit: bp.product.unit, quantity: bp.quantity }))
        });
      }
    }

    return res.status(404).json({ error: `Barcode "${code}" tidak ditemukan.` });
  } catch (err) {
    next(err);
  }
});

export default scanRouter;
