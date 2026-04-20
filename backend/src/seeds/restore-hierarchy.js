import prisma from "../lib/prisma.js";

async function main() {
  console.log("🚀 Starting CLEAN Warehouse Hierarchy Reset...");
  console.log(
    "⚠️ This will remove ALL existing locations, pallets, and boxes.",
  );

  try {
    // 1. CLEAR ALL DATA (Ordered to avoid FK violations)
    console.log("🧹 Clearing old data...");
    await prisma.transaction.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.stock.deleteMany();
    await prisma.boxProduct.deleteMany();
    await prisma.box.deleteMany();
    await prisma.pallet.deleteMany();
    await prisma.rackLevel.deleteMany();
    await prisma.section.deleteMany();
    await prisma.rack.deleteMany();
    await prisma.floor.deleteMany();
    console.log("✅ Database cleared.");

    // 2. CONFIGURE HIERARCHY
    // Format kode: L1-A-03-02 (Floor-Rack-Column-Level) → globally unique
    const floors = [
      { name: "Gudang Lantai 1", prefix: "L1" },
      { name: "Gudang Lantai 2", prefix: "L2" },
    ];
    const racks = ["A", "B", "C", "D", "E", "F"];
    const sectionsCount = 7;
    const levelsCount = 3;

    let createdFloors = 0;
    let createdRacks = 0;
    let createdSections = 0;
    let createdLevels = 0;

    // 3. GENERATE HIERARCHY with standardized codes
    for (const floorData of floors) {
      const floor = await prisma.floor.create({ data: { name: floorData.name } });
      createdFloors++;

      for (const rackLetter of racks) {
        const rack = await prisma.rack.create({
          data: { letter: rackLetter, floorId: floor.id },
        });
        createdRacks++;

        for (let sNum = 1; sNum <= sectionsCount; sNum++) {
          const sectionNum = sNum.toString().padStart(2, "0");
          const sectionCode = `${floorData.prefix}-${rackLetter}-${sectionNum}`;

          const section = await prisma.section.create({
            data: { number: sNum, rackId: rack.id, code: sectionCode },
          });
          createdSections++;

          for (let lNum = 1; lNum <= levelsCount; lNum++) {
            // Format: L1-A-03-02 (Floor prefix-Rack-Column-Level)
            const locationCode = `${floorData.prefix}-${rackLetter}-${sectionNum}-${lNum}`;

            await prisma.rackLevel.create({
              data: { 
                number: lNum, 
                sectionId: section.id,
                code: locationCode 
              },
            });
            createdLevels++;
          }
        }
      }
      console.log(`✅ Progress: Created ${floorData.name} structure.`);
    }

    // 4. CREATE "Incoming Area" — dedicated staging floor
    console.log("📦 Creating Incoming Area rack structure...");
    const incomingFloor = await prisma.floor.create({
      data: { name: "Incoming Area" },
    });
    const incomingRack = await prisma.rack.create({
      data: { letter: "IN", floorId: incomingFloor.id },
    });
    const incomingSection = await prisma.section.create({
      data: { number: 1, rackId: incomingRack.id },
    });
    await prisma.rackLevel.create({
      data: { number: 1, sectionId: incomingSection.id, code: "INCOMING" },
    });
    console.log("✅ Incoming Area ready — scan code: INCOMING");

    console.log("\n✨ RESET COMPLETE! ✨");
    console.log(`🏢 Floors:   ${createdFloors} Gudang + 1 Incoming Area`);
    console.log(`📟 Racks:    ${createdRacks} Rak (A–F per lantai) + 1 Incoming rack`);
    console.log(`📏 Baris:    ${createdSections} (7 per rak)`);
    console.log(`🪜 Levels:   ${createdLevels} (3 per baris)`);
    console.log(`\n📍 Format kode lokasi: [Rak]-[Kolom 2-digit]-[Level]`);
    console.log(`   Contoh: A-03-02 = Rak A, Kolom 3, Level 2`);
    console.log(`   Incoming Area scan code: INCOMING`);
    console.log("\nSemua lokasi siap digunakan (Clean Slate).");
  } catch (err) {
    console.error("❌ Reset failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
