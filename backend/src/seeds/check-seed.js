import prisma from "../lib/prisma.js";

async function main() {
  try {
    const floor = await prisma.floor.findFirst({ 
      where: { name: "Gudang Lantai 1" } 
    });
    
    // If standard floor missing, exit 0 to trigger seed
    if (!floor) {
      process.exit(0);
    }
    
    // Otherwise exit 1 to skip seed
    process.exit(1);
  } catch (err) {
    // On error, better to skip seed than potentially corrupting
    process.exit(1);
  }
}

main();
