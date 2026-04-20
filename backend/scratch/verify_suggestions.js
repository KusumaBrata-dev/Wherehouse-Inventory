import axios from 'axios';
import dotenv from 'dotenv';
import prisma from '../src/lib/prisma.js';
dotenv.config();

const API_URL = 'http://localhost:3001/api';

async function verifySuggestions() {
  console.log('🧪 Verifying Smart Placement Suggestions...');

  try {
    // 1. Auth
    const loginRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin123' });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Fetch Suggestions
    const reqRes = await axios.get(`${API_URL}/locations/suggestions/empty`, authHeaders);
    const suggestions = reqRes.data;

    console.log(`📡 Received ${suggestions.length} suggestions.`);

    if (suggestions.length === 0) {
      console.log('ℹ️ No empty locations found. (Maybe the warehouse is full or not seeded?)');
      return;
    }

    // 3. Deep Verify each suggestion in DB
    let allEmpty = true;
    for (const sug of suggestions) {
      const level = await prisma.rackLevel.findUnique({
        where: { id: sug.levelId },
        include: { pallets: true }
      });

      if (level.pallets.length > 0) {
        console.error(`❌ FAILED: Suggestion ${sug.path} is NOT empty (contains ${level.pallets.length} pallets)`);
        allEmpty = false;
      } else {
        console.log(`✅ VERIFIED: ${sug.path} is empty.`);
      }
    }

    if (allEmpty) {
      console.log('🎉 SUCCESS: All suggestions are truly empty levels!');
    }

  } catch (err) {
    console.error('💥 Verification crashed:', err.response?.data?.error || err.message);
  } finally {
    await prisma.$disconnect();
  }
}

verifySuggestions();
