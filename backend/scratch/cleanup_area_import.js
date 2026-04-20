import prisma from '../src/lib/prisma.js';

async function cleanup() {
  try {
    const floor = await prisma.floor.findFirst({
      where: { name: 'AREA IMPORT' }
    });
    
    if (floor) {
      await prisma.floor.delete({
        where: { id: floor.id }
      });
      console.log('✅ AREA IMPORT has been deleted from the database.');
    } else {
      console.log('ℹ️ AREA IMPORT was not found (already deleted).');
    }
  } catch (err) {
    console.error('❌ Error during cleanup:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

cleanup();
