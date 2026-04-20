import prisma from '../src/lib/prisma.js';

async function fix() {
  const prods = await prisma.product.findMany();
  let created = 0;
  for (const p of prods) {
    const stock = await prisma.stock.findUnique({ where: { productId: p.id } });
    if (!stock) {
      await prisma.stock.create({ data: { productId: p.id, quantity: 0 } });
      created++;
    }
  }
  console.log(`✅ All products have stock records. Created ${created} missing records.`);
  await prisma.$disconnect();
}

fix();
