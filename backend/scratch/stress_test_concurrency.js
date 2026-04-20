import prisma from '../src/lib/prisma.js';
import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';

async function stressTest() {
  console.log('🚀 Starting Concurrency Stress Test...');

  try {
    // 1. Setup: Find a test product and a target box
    const product = await prisma.product.findFirst();
    const box = await prisma.box.findFirst();
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!product || !box || !admin) {
      console.error('❌ Missing seed data (product/box/admin) to run test.');
      return;
    }

    console.log(`📦 Testing with Product: ${product.name} (ID: ${product.id})`);
    console.log(`📥 Target Box ID: ${box.id}`);

    // 2. Reset stock to known value (100) using ADJUST
    await prisma.boxProduct.upsert({
      where: { boxId_productId_lotNumber: { boxId: box.id, productId: product.id, lotNumber: '' } },
      update: { quantity: 100 },
      create: { boxId: box.id, productId: product.id, quantity: 100, lotNumber: '' }
    });
    await prisma.stock.update({
      where: { productId: product.id },
      data: { quantity: 100 }
    });

    console.log('✅ Initial Stock set to 100.');

    // 3. Login to get token
    // Assuming we already have admin/admin123
    const loginRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin123' });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 4. Fire 20 concurrent OUT transactions (-1 each)
    console.log('🔥 Firing 20 concurrent OUT transactions...');
    const startTime = Date.now();
    
    const requests = Array.from({ length: 20 }).map(() => 
      axios.post(`${API_URL}/transactions`, {
        productId: product.id,
        boxId: box.id,
        type: 'OUT',
        quantity: 1,
        note: 'Concurrency Test'
      }, authHeaders).catch(err => ({ error: err.response?.data?.error || err.message }))
    );

    const results = await Promise.all(requests);
    const duration = Date.now() - startTime;

    const successes = results.filter(r => r.data).length;
    const failures = results.filter(r => r.error).length;

    console.log(`⏱️ Finished in ${duration}ms`);
    console.log(`✅ Successes: ${successes}`);
    console.log(`❌ Failures: ${failures}`);

    // 5. Verify final stock
    const finalBp = await prisma.boxProduct.findUnique({
      where: { boxId_productId_lotNumber: { boxId: box.id, productId: product.id, lotNumber: '' } }
    });
    const finalStock = await prisma.stock.findUnique({
      where: { productId: product.id }
    });

    console.log(`📊 Final Box Qty: ${finalBp.quantity} (Expected: ${100 - successes})`);
    console.log(`📊 Final Global Qty: ${finalStock.quantity} (Expected: ${100 - successes})`);

    if (finalStock.quantity === (100 - successes) && successes === 20) {
      console.log('🎉 TEST PASSED! Concurrency is handled correctly.');
    } else {
      console.warn('⚠️ TEST COMPLETED WITH ANOMALIES. Check results.');
    }

  } catch (err) {
    console.error('💥 Test crashed:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

stressTest();
