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
    const levels = await prisma.rackLevel.findMany({
      include: {
        pallets: true,
        section: { include: { rack: { include: { floor: true } } } }
      },
      where: {
        section: {
          rack: {
            floor: {
              name: { not: 'Incoming Area' }  // Exclude staging area from suggestions
            }
          }
        }
      }
    });

    const suggestions = levels.filter(lvl => lvl.pallets.length < lvl.maxPallets);
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
      capacity: firstChoice.maxPallets
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
locationsRouter.patch('/pallets/:id/move', requireAdmin, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { newLevelId } = req.body;
    if (!newLevelId) return res.status(400).json({ error: 'newLevelId is required' });

    const oldPallet = await prisma.pallet.findUnique({
      where: { id: parseInt(id) },
      include: {
        rackLevel: { include: { section: { include: { rack: { include: { floor: true } } } } } },
        boxes: { include: { boxProducts: true } }
      }
    });

    if (!oldPallet) return res.status(404).json({ error: 'Pallet not found' });
    const oldPath = formatPath(oldPallet.rackLevel);

    const targetLevel = await prisma.rackLevel.findUnique({
      where: { id: parseInt(newLevelId) },
      include: { pallets: true }
    });
    if (!targetLevel) return res.status(404).json({ error: 'Target Level not found' });
    
    if (targetLevel.pallets.length >= targetLevel.maxPallets) {
      return res.status(400).json({ error: `Level tujuan penuh. Kapasitas maksimum: ${targetLevel.maxPallets} pallet.` });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedPallet = await tx.pallet.update({
        where: { id: parseInt(id) },
        data: { rackLevelId: parseInt(newLevelId) },
        include: {
          rackLevel: {
            include: { section: { include: { rack: { include: { floor: true } } } } }
          }
        }
      });

      const newPath = formatPath(updatedPallet.rackLevel);
      const note = `Putaway: ${oldPallet.name} (${oldPallet.code}) | ${oldPath} → ${newPath}`;

      const productMap = {};
      oldPallet.boxes.forEach(box => {
        box.boxProducts.forEach(bp => {
          if (!productMap[bp.productId]) productMap[bp.productId] = { qty: 0, boxId: box.id };
          productMap[bp.productId].qty += bp.quantity;
        });
      });

      const fromCode = oldPallet.rackLevel.code || oldPath;
      const toCode = updatedPallet.rackLevel.code || newPath;

      for (const [pid, data] of Object.entries(productMap)) {
        if (data.qty > 0) {
          await tx.transaction.create({
            data: {
              type: 'MOVE',
              productId: parseInt(pid),
              quantity: data.qty,
              boxId: data.boxId,
              note: note,
              fromLocationCode: fromCode,
              toLocationCode: toCode,
              userId: req.user.id
            }
          });
        }
      }

      // Mark all boxes on this pallet as STORED (putaway complete)
      const boxIds = oldPallet.boxes.map(b => b.id);
      if (boxIds.length > 0) {
        await tx.box.updateMany({
          where: { id: { in: boxIds } },
          data: { status: 'STORED' }
        });
      }

      return updatedPallet;
    });

    res.json({ message: 'Pallet berhasil dipindah dan dicatat di riwayat', pallet: result });
  } catch (err) {
    next(err);
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
// Body: { items: [{ productId, quantity, lotNumber? }], note? }
// Automatically places items in the INCOMING area, creates a pallet+box if not exists
locationsRouter.post('/inbound', requireAdminOrPPIC, async (req, res, next) => {
  try {
    const { items, note } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'items[] wajib diisi dan tidak boleh kosong.' });
    }

    // Find INCOMING floor and its first pallet
    const incomingFloor = await prisma.floor.findFirst({
      where: { name: 'Incoming Area' },
      include: {
        racks: {
          include: {
            sections: {
              include: {
                levels: { include: { pallets: { include: { boxes: true } } } }
              }
            }
          }
        }
      }
    });

    if (!incomingFloor) {
      return res.status(500).json({ error: 'Incoming Area tidak ditemukan. Jalankan seed untuk membuatnya.' });
    }

    // Find or create a pallet in INCOMING
    const firstLevel = incomingFloor.racks[0]?.sections[0]?.levels[0];
    if (!firstLevel) {
      return res.status(500).json({ error: 'Struktur Incoming Area tidak lengkap.' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Create a new "session" box in INCOMING for this inbound batch
      const ts = Date.now();
      const box = await tx.box.create({
        data: {
          code: `IN-${ts}`,
          name: `Inbound ${new Date().toLocaleDateString('id-ID')}`,
          status: 'RECEIVED',
          pallet: {
            create: {
              code: `PLT-IN-${ts}`,
              name: `Pallet Inbound ${new Date().toLocaleDateString('id-ID')}`,
              rackLevelId: firstLevel.id,
            }
          }
        }
      });

      const createdTrx = [];

      for (const item of items) {
        const pid = parseInt(item.productId);
        const qty = parseInt(item.quantity);
        const lot = item.lotNumber || '';

        if (!pid || !qty || qty <= 0) continue;

        // Upsert BoxProduct
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

        // Log IN transaction
        const trx = await tx.transaction.create({
          data: {
            type: 'IN',
            productId: pid,
            quantity: qty,
            userId: req.user.id,
            boxId: box.id,
            toLocationCode: 'INCOMING',
            note: note || `Direct Inbound → Incoming Area`,
          },
          include: {
            product: { select: { name: true, sku: true } }
          }
        });

        createdTrx.push(trx);
      }

      return { box, transactions: createdTrx };
    });

    res.status(201).json({
      message: `${result.transactions.length} produk berhasil masuk ke Incoming Area`,
      boxCode: result.box.code,
      transactions: result.transactions,
    });
  } catch (err) {
    next(err);
  }
});

export default locationsRouter;
