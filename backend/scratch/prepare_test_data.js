import prisma from '../src/lib/prisma.js';

async function checkData() {
  const pCount = await prisma.product.count();
  const bCount = await prisma.box.count();
  const uCount = await prisma.user.count();
  
  console.log('--- DATABASE STATS ---');
  console.log('Products:', pCount);
  console.log('Boxes:', bCount);
  console.log('Users:', uCount);
  
  if (pCount === 0 || bCount === 0) {
    console.log('⚠️ Seeding temporary data for stress test...');
    const prod = await prisma.product.create({
      data: { sku: 'TEST-PROD-01', name: 'Test Concurrency Product', unit: 'pcs' }
    });
    await prisma.stock.create({
      data: { productId: prod.id, quantity: 0 }
    });
    const box = await prisma.box.create({
      data: { code: 'TEST-BOX-01', name: 'Test Concurrency Box' }
    });
    console.log(`✅ Created Product ID: ${prod.id}, Stock initialized, Box ID: ${box.id}`);
  }
  
  await prisma.$disconnect();
}

checkData();
