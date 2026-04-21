
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulateRaceCondition() {
  console.log('🏁 Starting Multi-User Race Condition Simulation...');
  
  const palletCode = 'PLT-RACE-TEST';
  const levelCode = 'INCOMING';

  try {
    // Setup: Ensure pallet exists in INCOMING
    const level = await prisma.rackLevel.findUnique({ where: { code: levelCode } });
    if (!level) throw new Error('INCOMING level not found. Run seed.');

    await prisma.pallet.upsert({
      where: { code: palletCode },
      update: { status: 'RECEIVED' },
      create: { code: palletCode, rackLevelId: level.id, status: 'RECEIVED' }
    });

    console.log(`📡 Pallet ${palletCode} ready and RECEIVED.`);

    const user1_session = async () => {
      console.log('👤 User 1: Attempting to lock pallet...');
      return prisma.$transaction(async (tx) => {
        const p = await tx.pallet.findUnique({ where: { code: palletCode } });
        if (p.status === 'LOCKED') throw new Error('Pallet already locked');
        
        await tx.pallet.update({ where: { code: palletCode }, data: { status: 'LOCKED' } });
        console.log('👤 User 1: Pallet locked. Processing items (simulating delay)...');
        
        await new Promise(r => setTimeout(r, 3000)); // Simulate 3s processing
        
        await tx.pallet.update({ where: { code: palletCode }, data: { status: 'RECEIVED' } });
        console.log('👤 User 1: Process finished. Pallet UNLOCKED.');
        return 'SUCCESS';
      });
    };

    const user2_session = async () => {
      await new Promise(r => setTimeout(r, 1000)); // User 2 starts 1s after User 1
      console.log('👥 User 2: Attempting to lock pallet...');
      try {
        await prisma.$transaction(async (tx) => {
          const p = await tx.pallet.findUnique({ where: { code: palletCode } });
          if (p.status === 'LOCKED') throw new Error('RESOURCE_LOCKED_BY_OTHER');
          
          await tx.pallet.update({ where: { code: palletCode }, data: { status: 'LOCKED' } });
          return 'SUCCESS';
        });
      } catch (e) {
        console.log(`👥 User 2: 🚫 ACCESS DENIED - ${e.message}`);
        return 'REJECTED';
      }
    };

    const results = await Promise.all([user1_session(), user2_session()]);
    console.log('📊 Simulation Results:', results);

    if (results[0] === 'SUCCESS' && results[1] === 'REJECTED') {
      console.log('✅ LOCKING TEST PASSED: Concurrent access was correctly blocked.');
    } else {
      console.log('❌ LOCKING TEST FAILED: Locking did not work as expected.');
    }

  } catch (err) {
    console.error('💥 Simulation Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

simulateRaceCondition();
