import bcrypt from 'bcryptjs';
import prisma from '../lib/prisma.js';

async function seed() {
  console.log('🌱 Seeding database...');

  // Default categories
  const categories = ['Raw Material', 'Spare Part', 'Consumable', 'Finished Goods', 'Packaging', 'Chemical'];
  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }
  console.log('✅ Categories created');

  // Default admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { username: 'admin', passwordHash: adminPassword, name: 'Administrator', role: 'ADMIN' },
  });
  console.log(`✅ Admin user created: admin / admin123`);

  // Sample PPIC user
  const ppicPassword = await bcrypt.hash('ppic123', 12);
  await prisma.user.upsert({
    where: { username: 'ppic' },
    update: {},
    create: { username: 'ppic', passwordHash: ppicPassword, name: 'PPIC Staff', role: 'PPIC' },
  });
  console.log(`✅ PPIC user created: ppic / ppic123`);

  // Sample warehouse staff
  const staffPassword = await bcrypt.hash('staff123', 12);
  await prisma.user.upsert({
    where: { username: 'gudang' },
    update: {},
    create: { username: 'gudang', passwordHash: staffPassword, name: 'Staff Gudang', role: 'STAFF' },
  });
  console.log(`✅ Staff user created: gudang / staff123`);

  // Sample items
  const category = await prisma.category.findFirst({ where: { name: 'Spare Part' } });

  const sampleItems = [
    { name: 'Bearing 6205', sku: 'BRG-6205', unit: 'pcs', minStock: 10, description: 'Deep groove ball bearing' },
    { name: 'V-Belt A-50', sku: 'VBT-A50', unit: 'pcs', minStock: 5, description: 'V-belt tipe A panjang 50' },
    { name: 'Oli Mesin SAE 40', sku: 'OLI-SAE40', unit: 'liter', minStock: 20, description: 'Pelumas mesin SAE 40' },
    { name: 'Filter Udara', sku: 'FLT-001', unit: 'pcs', minStock: 5, description: 'Air filter cartridge' },
  ];

  for (const itemData of sampleItems) {
    const existing = await prisma.item.findUnique({ where: { sku: itemData.sku } });
    if (!existing) {
      const item = await prisma.item.create({
        data: { ...itemData, categoryId: category?.id },
      });
      await prisma.stock.create({ data: { itemId: item.id, quantity: Math.floor(Math.random() * 100) + 5 } });
      await prisma.rackLocation.create({
        data: { itemId: item.id, rackCode: `A-${Math.ceil(Math.random() * 5)}`, row: 'A', level: Math.ceil(Math.random() * 5) },
      });
    }
  }
  console.log('✅ Sample items created');

  console.log('\n🎉 Database seeded successfully!\n');
  console.log('Default accounts:');
  console.log('  admin   / admin123  (ADMIN)');
  console.log('  ppic    / ppic123   (PPIC)');
  console.log('  gudang  / staff123  (STAFF)\n');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
