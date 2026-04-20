import prisma from "../backend/src/lib/prisma.js";

async function check() {
  try {
    const products = await prisma.product.count();
    const categories = await prisma.category.count();
    const suppliers = await prisma.supplier.count();
    const floors = await prisma.floor.findMany();
    const stocks = await prisma.stock.count();
    
    console.log("--- SYSTEM TOTAL RESET AUDIT ---");
    console.log("PRODUK COUNT:", products);
    console.log("KATEGORI COUNT:", categories);
    console.log("SUPPLIER COUNT:", suppliers);
    console.log("STOCK COUNT:", stocks);
    console.log("FLOORS:", floors.map(f => f.name).join(", "));
    console.log("------------------------------");
  } catch (err) {
    console.error(err);
  } finally {
    await prisma.$disconnect();
  }
}

check();
