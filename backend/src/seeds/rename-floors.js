import prisma from "../lib/prisma.js";

async function main() {
  console.log("🚀 Renaming floors to match user preference...");
  
  try {
    const floors = await prisma.floor.findMany();
    
    for (const floor of floors) {
      if (floor.name === "Lantai 1") {
        await prisma.floor.update({
          where: { id: floor.id },
          data: { name: "Gudang Lantai 1" }
        });
        console.log("✅ Renamed 'Lantai 1' to 'Gudang Lantai 1'");
      } else if (floor.name === "Lantai 2") {
        await prisma.floor.update({
          where: { id: floor.id },
          data: { name: "Gudang Lantai 2" }
        });
        console.log("✅ Renamed 'Lantai 2' to 'Gudang Lantai 2'");
      }
    }
  } catch (err) {
    console.error("❌ Rename failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
