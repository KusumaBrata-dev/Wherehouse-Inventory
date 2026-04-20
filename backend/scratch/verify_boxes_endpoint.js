import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = 'http://localhost:3001/api';

async function verify() {
  console.log('🧪 Verifying POST /api/locations/boxes...');

  try {
    // 1. Login
    const loginRes = await axios.post(`${API_URL}/auth/login`, { username: 'admin', password: 'admin123' });
    const token = loginRes.data.token;
    const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

    // 2. Find a test pallet
    // I previously created Pallet in some scripts, or just check existing
    const boxesRes = await axios.get(`${API_URL}/locations/box-inventory`, authHeaders);
    const existingBox = boxesRes.data[0];
    const palletId = existingBox?.palletId;

    if (!palletId) {
       console.error('❌ No pallet found to test with. Create one first.');
       return;
    }

    // 3. Test POST
    const testCode = `TEST-B-${Date.now().toString().slice(-4)}`;
    const postRes = await axios.post(`${API_URL}/locations/boxes`, {
      name: 'Verification Test Box',
      code: testCode,
      palletId: palletId
    }, authHeaders);

    console.log('✅ Response:', postRes.data);
    if (postRes.data.code === testCode) {
      console.log('🎉 VERIFICATION PASSED!');
    } else {
      console.warn('⚠️ VERIFICATION FAILED: Unexpected response data.');
    }

  } catch (err) {
    console.error('💥 Verification failed:', err.response?.data?.error || err.message);
  }
}

verify();
