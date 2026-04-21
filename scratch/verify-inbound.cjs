
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testInbound() {
  console.log('🚀 Testing Inbound Logic...');

  try {
    // 1. Find or create Incoming Area for testing
    const floor = await prisma.floor.upsert({
      where: { name: 'Incoming Area' },
      update: {},
      create: { 
        name: 'Incoming Area',
        racks: {
          create: {
            name: 'IN-RACK',
            sections: {
              create: {
                name: 'IN-SEC',
                levels: {
                  create: { number: 1, code: 'INCOMING' }
                }
              }
            }
          }
        }
      },
      include: { racks: { include: { sections: { include: { levels: true } } } } }
    });

    const levelId = floor.racks[0].sections[0].levels[0].id;
    console.log(`✅ Test Level ID: ${levelId}`);

    // Create a product for testing
    const product = await prisma.product.upsert({
      where: { sku: 'TEST-SKU-001' },
      update: {},
      create: { name: 'Test Product', sku: 'TEST-SKU-001', unit: 'PCS' }
    });

    const palletCode = 'PLT-TEST-LOCK';
    
    // Ensure pallet doesn't exist or reset it
    await prisma.pallet.deleteMany({ where: { code: palletCode } });

    // SIMULATE INBOUND CALL 1 (Locking test)
    console.log('📦 Starting Inbound Batch 1 (Duplicate lots included)...');
    
    // We'll mimic the logic since we can't easily call the API route as a function here, 
    // but we can verify the transactional behavior.
    
    const items = [
      { productId: product.id, quantity: 10, lotNumber: 'LOT-A' },
      { productId: product.id, quantity: 5, lotNumber: 'LOT-A' }, // Duplicate lot
      { productId: product.id, quantity: 20, lotNumber: 'LOT-B' }
    ];

    // Merging logic test
    const aggregated = {};
    for (const it of items) {
      const key = `${it.productId}::${it.lotNumber}`;
      if (aggregated[key]) aggregated[key].quantity += it.quantity;
      else aggregated[key] = { ...it };
    }
    const merged = Object.values(aggregated);
    console.log('✅ Merged Items:', merged);

    // Transaction Test
    const result = await prisma.$transaction(async (tx) => {
      // Create Pallet
      const pallet = await tx.pallet.create({
        data: { code: palletCode, rackLevelId: levelId, status: 'LOCKED' }
      });
      console.log('🔒 Pallet LOCKED');

      // Create Box
      const box = await tx.box.create({
        data: { code: 'BOX-TEST', palletId: pallet.id, status: 'RECEIVED' }
      });

      for (const it of merged) {
        await tx.boxProduct.create({
          data: { boxId: box.id, productId: it.productId, quantity: it.quantity, lotNumber: it.lotNumber }
        });
      }

      // Unlock
      await tx.pallet.update({ where: { id: pallet.id }, data: { status: 'RECEIVED' } });
      console.log('🔓 Pallet UNLOCKED');
      return { pallet, box };
    });

    console.log('✨ Transaction successful');
    
    // Verify results
    const boxProducts = await prisma.boxProduct.findMany({ where: { boxId: result.box.id } });
    console.log('📊 Resulting BoxProducts:', boxProducts.length);
    boxProducts.forEach(bp => {
      console.log(` - Product ID: ${bp.productId}, Lot: ${bp.lotNumber}, Qty: ${bp.quantity}`);
    });

  } catch (err) {
    console.error('❌ Test failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testInbound();
