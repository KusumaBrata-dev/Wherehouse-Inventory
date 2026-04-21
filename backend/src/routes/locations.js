import { Router } from 'express';
import prisma from '../lib/prisma.js';
import { authenticate, requireAdmin, requireAdminOrPPIC } from '../middleware/auth.js';
import { validate, moveBulkSchema } from '../validations/wms.js';
import QRCode from 'qrcode';

export const locationsRouter = Router();

locationsRouter.use(authenticate);

// GET /api/locations/suggest — Smart auto-slotting for Putaway (INCOMING items only)
locationsRouter.get('/suggest', async (req, res, next) => {
  try {
    // Find levels that are not full AND not in Incoming Area
    // Logic: Bottom-up (Level 1 first) and Start of Rack (Section 1 first)
    const levels = await prisma.rackLevel.findMany({
      include: {
        pallets: true,
        section: { include: { rack: { include: { floor: true } } } }
      },
      where: {
        section: {
          rack: {
            floor: {
              name: { not: 'Incoming Area' }
            }
          }
        }
      },
      // Sort: Floor -> Rack -> Column (Section number) -> Level
      orderBy: [
        { section: { rack: { floor: { name: 'asc' } } } },
        { section: { rack: { letter: 'asc' } } },
        { section: { number: 'asc' } }, // Column 1 first
        { number: 'asc' }               // Level 1 first
      ]
    });

    const suggestions = levels.filter(lvl => lvl.pallets.length < (lvl.maxPallets || 20));
    if (suggestions.length === 0) {
       return res.json({ available: false, message: 'Seluruh rak penuh' });
    }

    const firstChoice = suggestions[0];
    res.json({
      available: true,
      levelId: firstChoice.id,
      code: firstChoice.code,
      path: formatPath(firstChoice),
      used: firstChoice.pallets.length,
      capacity: firstChoice.maxPallets || 20
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/locations/floors — List floors for sidebar
locationsRouter.get('/floors', async (req, res, next) => {
  try {
    const floors = await prisma.floor.findMany({
      orderBy: { name: 'asc' },
    });
    res.json(floors);
  } catch (err) {
    next(err);
  }
});

// GET /api/locations/personal — List items assigned to specific persons
locationsRouter.get('/personal', async (req, res, next) => {
  try {
    const personalBoxes = await prisma.box.findMany({
      where: { isPersonal: true },
      include: {
        holder: { select: { id: true, name: true, role: true } },
        boxProducts: { include: { product: true } }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(personalBoxes);
  } catch (err) {
    next(err);
  }
});

// GET /api/locations — List hierarchy filtered by floor
locationsRouter.get('/', async (req, res, next) => {
  try {
    const { floorId } = req.query;
    
    const where = floorId ? { id: parseInt(floorId) } : {};

    const floors = await prisma.floor.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        racks: {
          orderBy: { letter: 'asc' },
          include: {
            sections: {
              orderBy: { number: 'asc' },
              include: {
                levels: {
                  orderBy: { number: 'asc' },
                  include: {
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
                }
              }
            }
          }
        }
      }
    });

    res.json(floors);
  } catch (err) {
    next(err);
  }
});

// GET /api/locations/search — Global inventory search
locationsRouter.get('/search', async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q) return res.json([]);

    const searchData = await Promise.all([
      // 1. Search Products
      prisma.product.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { sku: { contains: q, mode: 'insensitive' } }
          ]
        },
        include: {
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
        take: 20
      }),
      // 2. Search Boxes
      prisma.box.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } }
          ]
        },
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
        },
        take: 20
      }),
      // 3. Search Pallets
      prisma.pallet.findMany({
        where: {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { code: { contains: q, mode: 'insensitive' } }
          ]
        },
        include: {
          rackLevel: {
            include: {
              section: { include: { rack: { include: { floor: true } } } }
            }
          }
        },
        take: 20
      }),
      // 4. Search Personnel (Staff)
      prisma.user.findMany({
        where: {
          name: { contains: q, mode: 'insensitive' }
        },
        include: {
          boxes: { include: { boxProducts: { include: { product: true } } } }
        },
        take: 10
      })
    ]);

    const [products, boxes, pallets, users] = searchData;

    // Format results with path
    const results = [
      ...products.flatMap(product => product.boxProducts.map(bp => ({
        id: `product-${product.id}-${bp.boxId}`,
        type: 'product',
        title: product.name,
        name: product.name,
        code: product.sku,
        boxCode: bp.box.code,
        path: formatPath(bp.box.pallet?.rackLevel),
        location: bp.box.pallet?.rackLevel
      }))),
      ...boxes.map(box => ({
        id: `box-${box.id}`,
        type: 'box',
        title: box.name,
        name: box.name,
        code: box.code,
        path: formatPath(box.pallet?.rackLevel) || (box.isPersonal ? `Staf: ${box.holder?.name}` : 'Tanpa Lokasi'),
        location: box.pallet?.rackLevel
      })),
      ...pallets.map(p => ({
        id: `pallet-${p.id}`,
        type: 'pallet',
        title: p.name,
        name: p.name,
        code: p.code,
        path: formatPath(p.rackLevel),
        location: p.rackLevel
      })),
      ...users.map(u => ({
        id: `user-${u.id}`,
        type: 'user',
        title: u.name,
        name: u.name,
        code: u.role,
        path: `Staff Gudang (${u.boxes?.length || 0} Assets)`,
        location: null
      }))
    ];

    // Add search for personal boxes
    const personalBoxesSearch = await prisma.box.findMany({
      where: {
        isPersonal: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
          { holder: { name: { contains: q, mode: 'insensitive' } } }
        ]
      },
      include: { holder: true },
      take: 10
    });

    results.push(...personalBoxesSearch.map(box => ({
      id: `personal-box-${box.id}`,
      type: 'personal-box',
      name: box.name || `Asset: ${box.holder?.name}`,
      code: box.code,
      path: `Personil: ${box.holder?.name || 'Unassigned'}`,
      location: null
    })));

    res.json(results);
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/racks — Add new rack row to a floor
locationsRouter.post('/racks', async (req, res, next) => {
  try {
    const { letter, floorId } = req.body;
    const rack = await prisma.rack.create({
      data: { letter, floorId: parseInt(floorId) }
    });
    res.json(rack);
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/sections — Add new section (column) to a rack
locationsRouter.post('/sections', async (req, res, next) => {
  try {
    const { number, rackId } = req.body;
    const section = await prisma.section.create({
      data: { number: parseInt(number), rackId: parseInt(rackId) }
    });
    res.json(section);
  } catch (err) {
    next(err);
  }
});

// POST /api/locations/levels — Add new level to a section
locationsRouter.post('/levels', async (req, res, next) => {
  try {
    const { number, sectionId } = req.body;
    const level = await prisma.rackLevel.create({
      data: { number: parseInt(number), sectionId: parseInt(sectionId) }
    });
    res.json(level);
  } catch (err) {
    next(err);
  }
});

function formatPath(level) {
  if (!level) return 'Tidak terdata';
  const f = level.section.rack.floor.name;
  const r = level.section.rack.letter;
  const s = level.section.number;
  const l = level.number;
  return `${f} > Rak ${r}${s} > Level ${l}`;
}

// POST /api/locations/pallets — Register new pallet
locationsRouter.post('/pallets', async (req, res, next) => {
  try {
    const { code, name, rackLevelId } = req.body;
    if (!code || !rackLevelId) return res.status(400).json({ error: 'Kode dan Level Rak wajib diisi' });
    
    const pallet = await prisma.pallet.create({
      data: { code, name: name || null, rackLevelId: parseInt(rackLevelId) },
      include: {
        rackLevel: {
          include: { section: { include: { rack: { include: { floor: true } } } } }
        }
      }
    });
    res.json(pallet);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Kode Pallet sudah digunakan' });
    next(err);
  }
});

// POST /api/locations/boxes/personal — Register new personal box
locationsRouter.post('/boxes/personal', async (req, res, next) => {
  try {
    const { code, name, holderId } = req.body;
    if (!code || !holderId) return res.status(400).json({ error: 'Kode dan Pemegang (Staff) wajib diisi' });

    const box = await prisma.box.create({
      data: { 
        code, 
        name: name || null, 
        isPersonal: true, 
        holderId: parseInt(holderId) 
      },
      include: { holder: true }
    });
    res.json(box);
  } catch (err) {
    if (err.code === 'P2002') return res.status(400).json({ error: 'Kode Asset/Box sudah digunakan' });
    next(err);
  }
});

// PUT /api/locations/boxes/:id — Update box info
locationsRouter.put('/boxes/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { name, code } = req.body;
    const box = await prisma.box.update({
      where: { id: parseInt(id) },
      data: { name, code }
    });
    res.json(box);
  } catch (err) {
    next(err);
  }
});

// DELETE /boxes/:id route has been deduplicated here.
// PATCH routes have been deduplicated.
// POST /api/locations/cleanup-auto — Delete empty auto-generated boxes
locationsRouter.post('/cleanup-auto', requireAdmin, async (req, res, next) => {
  try {
    const boxes = await prisma.box.findMany({
      where: { name: { contains: 'Auto-Generated' } },
      include: { boxProducts: true }
    });
    
    let deletedCount = 0;
    
    await prisma.$transaction(async (tx) => {
      for (const box of boxes) {
        // Check if box is effectively empty (no products or all qty 0)
        const isEmpty = box.boxProducts.length === 0 || box.boxProducts.every(bp => bp.quantity === 0);
        
        if (isEmpty) {
          // Disconnect transactions from this box so it can be deleted
          await tx.transaction.updateMany({
            where: { boxId: box.id },
            data: { boxId: null }
          });
          
          // Clear box items (the items themselves remain in Master Stock)
          await tx.boxProduct.deleteMany({ where: { boxId: box.id } });
          
          // Finally delete the box
          await tx.box.delete({ where: { id: box.id } });
          deletedCount++;
        }
      }
    });
    
    res.json({ message: `Berhasil menghapus ${deletedCount} box auto-generated yang kosong.` });
  } catch (err) {
    next(err);
  }
});

// GET /api/locations/box-inventory — List inventory grouped by Box
locationsRouter.get('/box-inventory', async (req, res, next) => {
  try {
    const boxes = await prisma.box.findMany({
      include: {
        pallet: {
          include: {
            rackLevel: {
              include: {
                section: { include: { rack: { include: { floor: true } } } }
              }
            }
          }
        },
        boxProducts: {
          include: { product: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(boxes);
  } catch (err) {
    next(err);
  }
});

// GET /api/locations/qr — Generate QR for any location type
locationsRouter.get('/qr', async (req, res, next) => {
  try {
    const { type, id } = req.query;
    if (!type || !id) return res.status(400).json({ error: 'type and id are required' });

    let name = '';
    let qrValue = '';

    if (type === 'floor') {
      const f = await prisma.floor.findUnique({ where: { id: parseInt(id) } });
      name = f.name;
      qrValue = `LOC:FLR:${f.id}`;
    } else if (type === 'rack') {
      const r = await prisma.rack.findUnique({ where: { id: parseInt(id) }, include: { floor: true } });
      name = `Rak ${r.letter} (${r.floor.name})`;
      qrValue = `LOC:RCK:${r.id}`;
    } else if (type === 'section') {
      const s = await prisma.section.findUnique({ where: { id: parseInt(id) }, include: { rack: true } });
      name = `Baris ${s.rack.letter}${s.number}`;
      qrValue = `LOC:SEC:${s.id}`;
    } else if (type === 'level') {
      const l = await prisma.rackLevel.findUnique({ where: { id: parseInt(id) }, include: { section: { include: { rack: true } } } });
      name = `Rak ${l.section.rack.letter}${l.section.number} Level ${l.number}`;
      qrValue = `LOC:LVL:${l.id}`;
    } else if (type === 'pallet') {
      const p = await prisma.pallet.findUnique({ where: { id: parseInt(id) } });
      name = p.name || p.code;
      qrValue = `LOC:PAL:${p.id}`; 
    } else if (type === 'box') {
      const b = await prisma.box.findUnique({ where: { id: parseInt(id) } });
      name = b.name || b.code;
      qrValue = `LOC:BOX:${b.id}`;
    }

    const qrBuffer = await QRCode.toBuffer(qrValue, {
      width: 400,
      margin: 2,
      color: { dark: '#0f1629', light: '#ffffff' }
    });

    res.setHeader('Content-Type', 'image/png');
    res.send(qrBuffer);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/locations/boxes/:id
locationsRouter.delete('/boxes/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const boxId = parseInt(id);
    
    const box = await prisma.box.findUnique({
      where: { id: boxId },
      include: { boxProducts: true }
    });

    if (!box) return res.status(404).json({ error: 'Box tidak ditemukan' });
    if (box.boxProducts.some(bp => bp.quantity > 0)) {
      return res.status(400).json({ error: 'Box tidak dapat dihapus karena masih berisi stok produk.' });
    }

    await prisma.$transaction(async (tx) => {
      // Disconnect transactions
      await tx.transaction.updateMany({
        where: { boxId },
        data: { boxId: null }
      });
      
      // Delete BoxProducts
      await tx.boxProduct.deleteMany({ where: { boxId } });
      
      // Delete Box
      await tx.box.delete({ where: { id: boxId } });
    });
    
    res.json({ message: 'Box berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});


// POST /api/locations/move-bulk — Move a rack/column/level atomically
locationsRouter.post('/move-bulk', requireAdmin, validate(moveBulkSchema), async (req, res, next) => {
  try {
    const { sourceType, sourceCode, targetLevelCode } = req.validData;
    const userId = req.user?.id;

    if (!sourceCode || !sourceType || !targetLevelCode) {
      return res.status(400).json({ error: 'sourceCode, sourceType, dan targetLevelCode wajib diisi' });
    }

    const targetLevel = await prisma.rackLevel.findUnique({
      where: { code: targetLevelCode },
      include: { pallets: true }
    });
    if (!targetLevel) return res.status(404).json({ error: 'Lokasi tujuan tidak ditemukan' });

    let palletsToMove = [];
    if (sourceType === 'LEVEL') {
      const sourceLevel = await prisma.rackLevel.findUnique({ 
        where: { code: sourceCode }, 
        include: { pallets: { include: { boxes: { include: { boxProducts: true } }, rackLevel: true } } } 
      });
      if (!sourceLevel) return res.status(404).json({ error: 'Lokasi sumber (LEVEL) tidak ditemukan' });
      palletsToMove = sourceLevel.pallets;
    } else if (sourceType === 'COLUMN') {
      const section = await prisma.section.findUnique({ 
        where: { code: sourceCode }, 
        include: { levels: { include: { pallets: { include: { boxes: { include: { boxProducts: true } }, rackLevel: true } } } } } 
      });
      if (!section) return res.status(404).json({ error: 'Lokasi sumber (COLUMN) tidak ditemukan' });
      section.levels.forEach(l => palletsToMove.push(...l.pallets));
    } else if (sourceType === 'RACK') {
      const section = await prisma.section.findFirst({ 
        where: { code: { startsWith: sourceCode + '-' } }, 
        include: { rack: { include: { sections: { include: { levels: { include: { pallets: { include: { boxes: { include: { boxProducts: true } }, rackLevel: true } } } } } } } } } 
      });
      if (!section || !section.rack) return res.status(404).json({ error: 'Lokasi sumber (RACK) tidak ditemukan' });
      section.rack.sections.forEach(s => s.levels.forEach(l => palletsToMove.push(...l.pallets)));
    } else {
      return res.status(400).json({ error: 'sourceType invalid (harus LEVEL, COLUMN, atau RACK)' });
    }

    if (palletsToMove.length === 0) {
      return res.status(400).json({ error: 'Tidak ada pallet di lokasi sumber untuk dipindah' });
    }

    if (targetLevel.pallets.length + palletsToMove.length > targetLevel.maxPallets) {
      return res.status(400).json({ error: `Kapasitas lokasi tujuan tidak cukup (Maksimal ${targetLevel.maxPallets} pallet).` });
    }

    const targetCode = targetLevel.code;

    const result = await prisma.$transaction(async (tx) => {
      for (const pallet of palletsToMove) {
        if (pallet.rackLevelId === targetLevel.id) continue;

        const fromCode = pallet.rackLevel.code;
        
        await tx.pallet.update({
          where: { id: pallet.id },
          data: { rackLevelId: targetLevel.id }
        });

        const productMap = {};
        pallet.boxes.forEach(box => {
          box.boxProducts.forEach(bp => {
            if (!productMap[bp.productId]) productMap[bp.productId] = { qty: 0, boxId: box.id };
            productMap[bp.productId].qty += bp.quantity;
          });
        });

        for (const [pid, data] of Object.entries(productMap)) {
          if (data.qty > 0) {
            await tx.transaction.create({
              data: {
                type: 'MOVE',
                productId: parseInt(pid),
                quantity: data.qty,
                boxId: data.boxId,
                note: `Bulk Relokasi: Pallet ${pallet.code} | Dari: ${fromCode} | Ke: ${targetCode}`,
                fromLocationCode: fromCode,
                toLocationCode: targetCode,
                userId: userId
              }
            });
          }
        }
      }
      return palletsToMove.length;
    });

    res.json({ message: `Berhasil memindahkan ${result} pallet ke ${targetCode}`, palletsMoved: result });
  } catch (err) {
    next(err);
  }
});

// PATCH /api/locations/pallets/:id/move
locationsRouter.patch('/pallets/:id/move', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newLevelId } = req.body;
    if (!newLevelId) return res.status(400).json({ error: 'newLevelId is required' });

    const palletId = parseInt(id);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch pallet with all required context
      const pallet = await tx.pallet.findUnique({
        where: { id: palletId },
        include: {
          rackLevel: { include: { section: { include: { rack: { include: { floor: true } } } } } },
          boxes: { include: { boxProducts: { include: { product: true } } } }
        }
      });

      if (!pallet) throw new Error(`Pallet ID ${palletId} tidak ditemukan.`);

      // 2. STRICTOR VALIDATIONS
      const currentLocName = pallet.rackLevel.section.rack.floor.name;
      
      // Validation: Source Must be Incoming Area if move type is Putaway (implied here)
      // Note: If we want to allow general relocation, we can skip this, 
      // but per requirement: Putaway MUST start from INCOMING.
      if (currentLocName !== 'Incoming Area') {
        throw new Error(`Pallet "${pallet.code}" sudah berada di rak (${formatPath(pallet.rackLevel)}). Gunakan menu Pindah Stok untuk relokasi antar rak.`);
      }

      // Validation: Status must be RECEIVED (not STORED or LOCKED)
      if (pallet.status === 'LOCKED') {
        throw new Error(`Pallet "${pallet.code}" sedang dikunci oleh proses inbound aktif.`);
      }
      if (pallet.status === 'STORED') {
        throw new Error(`Pallet "${pallet.code}" sudah berstatus STORED.`);
      }

      // Validation: Target Level exists and has capacity
      const targetLevel = await tx.rackLevel.findUnique({
        where: { id: parseInt(newLevelId) },
        include: { pallets: true, section: { include: { rack: { include: { floor: true } } } } }
      });

      if (!targetLevel) throw new Error('Level tujuan tidak valid.');
      if (targetLevel.id === pallet.rackLevelId) throw new Error('Level tujuan sama dengan lokasi saat ini.');

      if (targetLevel.pallets.length >= (targetLevel.maxPallets || 20)) {
        throw new Error(`Lokasi "${targetLevel.code}" sudah penuh (${targetLevel.maxPallets} pallet).`);
      }

      // 3. EXECUTE MOVE
      const updatedPallet = await tx.pallet.update({
        where: { id: palletId },
        data: { 
          rackLevelId: targetLevel.id,
          status: 'STORED' // Transition to STORED
        },
        include: {
          rackLevel: { include: { section: { include: { rack: { include: { floor: true } } } } } }
        }
      });

      // 4. Update all Boxes on this pallet to STORED
      const boxIds = pallet.boxes.map(b => b.id);
      if (boxIds.length > 0) {
        await tx.box.updateMany({
          where: { id: { in: boxIds } },
          data: { status: 'STORED' }
        });
      }

      // 5. Create Transaction Logs for every product
      const productMap = {};
      pallet.boxes.forEach(box => {
        box.boxProducts.forEach(bp => {
          const key = `${bp.productId}::${box.id}`;
          if (!productMap[key]) productMap[key] = { qty: 0, productId: bp.productId, boxId: box.id, sku: bp.product.sku, name: bp.product.name };
          productMap[key].qty += bp.quantity;
        });
      });

      const oldPath = formatPath(pallet.rackLevel);
      const newPath = formatPath(updatedPallet.rackLevel);

      for (const entry of Object.values(productMap)) {
        await tx.transaction.create({
          data: {
            type: 'MOVE',
            productId: entry.productId,
            quantity: entry.qty,
            boxId: entry.boxId,
            userId: req.user.id,
            fromLocationCode: oldPath,
            toLocationCode: newPath,
            note: `Putaway: Pallet ${pallet.code} | ${entry.sku} | Qty: ${entry.qty}`
          }
        });
      }

      return updatedPallet;
    });

    res.json({ message: 'Putaway berhasil. Pallet telah dipindahkan dan dikunci ke rak.', pallet: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/locations/pallets/:id
locationsRouter.delete('/pallets/:id', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const palletId = parseInt(id);
    
    // Get all boxes in this pallet
    const boxes = await prisma.box.findMany({ where: { palletId } });
    
    await prisma.$transaction(async (tx) => {
      for (const box of boxes) {
         await tx.transaction.updateMany({ where: { boxId: box.id }, data: { boxId: null } });
         await tx.boxProduct.deleteMany({ where: { boxId: box.id } });
         await tx.box.delete({ where: { id: box.id } });
      }
      
      await tx.pallet.delete({ where: { id: palletId } });
    });
    
    res.json({ message: 'Pallet dan seluruh isinya berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/locations/levels/:id
locationsRouter.delete('/levels/:id', async (req, res, next) => {
  try {
    await prisma.rackLevel.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Level Rak berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/locations/sections/:id
locationsRouter.delete('/sections/:id', async (req, res, next) => {
  try {
    await prisma.section.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Seksi/Kolom berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/locations/racks/:id
locationsRouter.delete('/racks/:id', async (req, res, next) => {
  try {
    await prisma.rack.delete({ where: { id: parseInt(req.params.id) } });
    res.json({ message: 'Rak berhasil dihapus' });
  } catch (err) {
    next(err);
  }
});


// POST /api/locations/inbound — Direct inbound (no PO required)
// Body: { palletCode?, items: [{ productId, quantity, lotNumber? }], note? }
// - palletCode: scan an existing INCOMING pallet, or omit to auto-create
// - Items are merged by productId+lotNumber before persist (anti-duplicate)
locationsRouter.post('/inbound', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { items, note, palletCode } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] wajib diisi dan tidak boleh kosong.' });
    }

    // ── Find INCOMING Area ─────────────────────────────────────────────────
    const incomingFloor = await prisma.floor.findFirst({
      where: { name: 'Incoming Area' },
      include: {
        racks: {
          include: {
            sections: { include: { levels: true } }
          }
        }
      }
    });
    if (!incomingFloor) {
      return res.status(500).json({ error: 'Incoming Area tidak ditemukan di database.' });
    }
    const firstLevel = incomingFloor.racks[0]?.sections[0]?.levels[0];
    if (!firstLevel) {
      return res.status(500).json({ error: 'Struktur rak Incoming Area tidak lengkap. Jalankan seed.' });
    }

    // ── Validate or resolve Pallet ─────────────────────────────────────────
    let existingPallet = null;
    if (palletCode) {
      existingPallet = await prisma.pallet.findUnique({
        where: { code: palletCode },
        include: {
          rackLevel: {
            include: { section: { include: { rack: { include: { floor: true } } } } }
          },
          boxes: { include: { boxProducts: true } }
        }
      });
      if (!existingPallet) {
        return res.status(404).json({ error: `Pallet "${palletCode}" tidak ditemukan.` });
      }
      // ── STRICT: Pallet MUST be in INCOMING or completely empty ─────────
      const floorName = existingPallet.rackLevel?.section?.rack?.floor?.name;
      const hasInventory = existingPallet.boxes.some(b => b.boxProducts.length > 0);
      const isInIncoming = floorName === 'Incoming Area';
      const isEmpty = !hasInventory;

      if (!isInIncoming && !isEmpty) {
        return res.status(409).json({
          error: `Pallet "${palletCode}" sedang berada di ${floorName} dengan isi aktif. Tidak dapat digunakan untuk inbound.`
        });
      }
      // Reject if already locked by another session
      if (existingPallet.status === 'LOCKED') {
        return res.status(423).json({
          error: `Pallet "${palletCode}" sedang dikunci oleh sesi inbound lain. Tunggu sebentar dan coba lagi.`
        });
      }
    }

    // ── Aggregate items by productId + lotNumber (prevent duplicate rows) ──
    const aggregated = {};
    for (const item of items) {
      const pid = parseInt(item.productId);
      const qty = parseInt(item.quantity);
      const lot = item.lotNumber?.trim() || '';
      if (!pid || isNaN(qty) || qty <= 0) continue;
      const key = `${pid}::${lot}`;
      if (aggregated[key]) {
        aggregated[key].quantity += qty;
      } else {
        aggregated[key] = { productId: pid, quantity: qty, lotNumber: lot };
      }
    }
    const mergedItems = Object.values(aggregated);
    if (mergedItems.length === 0) {
      return res.status(400).json({ error: 'Tidak ada item valid di dalam daftar inbound.' });
    }

    // ── ATOMIC TRANSACTION ─────────────────────────────────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const ts = Date.now();
      let pallet;

      if (existingPallet) {
        // LOCK the pallet immediately to prevent race condition
        pallet = await tx.pallet.update({
          where: { id: existingPallet.id },
          data: { status: 'LOCKED' }
        });
      } else {
        // Auto-create a new pallet+box in INCOMING
        const newBox = await tx.box.create({
          data: {
            code: `IN-${ts}`,
            name: `Inbound ${new Date().toLocaleDateString('id-ID')}`,
            status: 'RECEIVED',
            pallet: {
              create: {
                code: `PLT-IN-${ts}`,
                name: `Pallet Inbound ${new Date().toLocaleDateString('id-ID')}`,
                rackLevelId: firstLevel.id,
                status: 'LOCKED', // Lock immediately
              }
            }
          },
          include: { pallet: true }
        });
        pallet = newBox.pallet;
      }

      // Get or create a box inside this pallet for the batch
      let box = await tx.box.findFirst({
        where: { palletId: pallet.id, status: 'RECEIVED' },
        include: { _count: { select: { boxProducts: true } } }
      });

      if (!box) {
        // Check pallet capacity (maxBoxes)
        const boxCount = await tx.box.count({ where: { palletId: pallet.id } });
        if (boxCount >= (pallet.maxBoxes || 80)) {
          throw new Error(`Pallet "${pallet.code}" sudah mencapai kapasitas maksimal (${pallet.maxBoxes} box).`);
        }

        box = await tx.box.create({
          data: {
            code: `BOX-${ts}`,
            name: `Box Inbound ${new Date().toLocaleDateString('id-ID')}`,
            status: 'RECEIVED',
            palletId: pallet.id,
          }
        });
      }

      const createdTrx = [];
      for (const item of mergedItems) {
        const { productId: pid, quantity: qty, lotNumber: lot } = item;

        // Upsert BoxProduct (idempotent — safe to re-run)
        await tx.boxProduct.upsert({
          where: { boxId_productId_lotNumber: { boxId: box.id, productId: pid, lotNumber: lot } },
          update: { quantity: { increment: qty } },
          create: { boxId: box.id, productId: pid, quantity: qty, lotNumber: lot },
        });

        // Update global Stock
        await tx.stock.upsert({
          where: { productId: pid },
          update: { quantity: { increment: qty } },
          create: { productId: pid, quantity: qty },
        });

        // Log IN transaction with full audit trail
        const trx = await tx.transaction.create({
          data: {
            type: 'IN',
            productId: pid,
            quantity: qty,
            userId: req.user.id,
            boxId: box.id,
            toLocationCode: 'INCOMING',
            note: [
              note,
              `Direct Inbound → Incoming Area`,
              `Pallet: ${pallet.code}`,
              `Box: ${box.code}`,
              lot ? `Lot: ${lot}` : null,
            ].filter(Boolean).join(' | '),
          },
          include: { product: { select: { name: true, sku: true } } }
        });
        createdTrx.push(trx);
      }

      // ── UNLOCK pallet: set back to RECEIVED after success ─────────────
      await tx.pallet.update({
        where: { id: pallet.id },
        data: { status: 'RECEIVED' }
      });

      return { pallet, box, transactions: createdTrx };
    });

    res.status(201).json({
      message: `${result.transactions.length} produk berhasil dicatat ke Incoming Area`,
      palletCode: result.pallet.code,
      boxCode: result.box.code,
      itemCount: result.transactions.length,
      transactions: result.transactions,
    });
  } catch (err) {
    next(err);
  }
});

export default locationsRouter;
