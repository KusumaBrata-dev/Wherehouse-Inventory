import prisma from '../src/lib/prisma.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';

async function verify() {
  console.log('🧪 Verifying POST /api/locations/boxes with setup...');

  try {
    // 1. Setup: Ensure a Floor/Rack/Section/Level exists
    let floor = await prisma.floor.findFirst();
    if (!floor) floor = await prisma.floor.create({ data: { name: 'Test Floor' } });
    
    let rack = await prisma.rack.findFirst({ where: { floorId: floor.id } });
    if (!rack) rack = await prisma.rack.create({ data: { letter: 'Z', floorId: floor.id } });

    let section = await prisma.section.findFirst({ where: { rackId: rack.id } });
    if (!section) section = await prisma.section.create({ data: { number: 99, rackId: rack.id } });

    let level = await prisma.rackLevel.findFirst({ where: { sectionId: section.id } });
    if (!level) level = await prisma.rackLevel.create({ data: { number: 9, sectionId: section.id } });

    let pallet = await prisma.pallet.findFirst({ where: { rackLevelId: level.id } });
    if (!pallet) pallet = await prisma.pallet.create({ data: { code: 'PALL-TEST-99', name: 'Test Pallet', rackLevelId: level.id } });

    console.log(`✅ Using Pallet ID: ${pallet.id}`);

    // 2. Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin123' });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 3. Test POST /boxes
    const testCode = `BOX-T-${Date.now().toString().slice(-4)}`;
    const postRes = await axios.post(`${API_URL}/locations/boxes`, {
      name: 'Verification Test Box',
      code: testCode,
      palletId: pallet.id
    }, authHeaders);

    console.log('✅ Response:', postRes.data);
    if (postRes.data.code === testCode && postRes.data.palletId === pallet.id) {
      console.log('🎉 VERIFICATION PASSED!');
    } else {
      console.warn('⚠️ VERIFICATION FAILED: Unexpected response data.');
    }

  } catch (err) {
    console.error('💥 Verification failed:', err.response?.data?.error || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verify();
