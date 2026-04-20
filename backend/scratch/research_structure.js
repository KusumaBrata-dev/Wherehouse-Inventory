import prisma from '../src/lib/prisma.js';

async function research() {
  try {
    const floors = await prisma.floor.findMany({
      include: {
        racks: {
          include: {
            sections: {
              include: {
                levels: {
                  include: {
                    pallets: true
                  }
                }
              }
            }
          }
        }
      }
    });
    
    console.log('--- WAREHOUSE STRUCTURE ---');
    floors.forEach(f => {
      console.log(`Floor: ${f.name} (ID: ${f.id})`);
      f.racks.forEach(r => {
        console.log(`  Rack ${r.letter} (ID: ${r.id})`);
        r.sections.forEach(s => {
          process.stdout.write(`    Sec ${s.number}: `);
          s.levels.forEach(l => {
            process.stdout.write(`L${l.number} `);
          });
          console.log();
        });
      });
    });
  } catch (err) {
    console.error('Error during research:', err);
  } finally {
    await prisma.$disconnect();
  }
}

research();
