import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const client = new PrismaClient({ adapter });

async function test() {
  try {
    const count = await client.user.count();
    console.log('✅ Database connection OK! Users:', count);
  } catch (e) {
    console.error('❌ Connection failed:', e.message);
  } finally {
    await client.$disconnect();
    await pool.end();
  }
}
test();
