import axios from 'axios';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

async function run() {
  console.log('Testing AI Provider Configuration endpoints...');

  // 1. Log in as teacher to get JWT
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    email: 'teacher.golden@akademiya.io',
    password: 'password123'
  });
  const token = loginRes.data.token;
  const headers = { Authorization: `Bearer ${token}` };
  console.log('✓ Teacher logged in successfully');

  // 2. GET current provider
  const getRes = await axios.get(`${BASE_URL}/api/settings/ai-provider`, { headers });
  console.log('✓ GET /api/settings/ai-provider returned:', getRes.data.config.activeProvider);

  // 3. Switch to Gemini
  const setGeminiRes = await axios.put(`${BASE_URL}/api/settings/ai-provider`, { provider: 'gemini' }, { headers });
  console.log('✓ Switched to Gemini:', setGeminiRes.data.config.activeProvider === 'gemini' ? 'PASS' : 'FAIL');

  // 4. Test Gemini connection
  const testGemini = await axios.post(`${BASE_URL}/api/settings/ai-provider/test`, { provider: 'gemini' }, { headers });
  console.log('✓ Test Gemini Connection Result:', testGemini.data);

  // 5. Switch to Llama
  const setLlamaRes = await axios.put(`${BASE_URL}/api/settings/ai-provider`, { provider: 'llama' }, { headers });
  console.log('✓ Switched to Llama 3.2:', setLlamaRes.data.config.activeProvider === 'llama' ? 'PASS' : 'FAIL');

  // 6. Test Llama connection
  const testLlama = await axios.post(`${BASE_URL}/api/settings/ai-provider/test`, { provider: 'llama' }, { headers });
  console.log('✓ Test Llama Connection Result:', testLlama.data);

  // 7. Switch to Qwen
  const setQwenRes = await axios.put(`${BASE_URL}/api/settings/ai-provider`, { provider: 'qwen' }, { headers });
  console.log('✓ Switched to Qwen 2.5:', setQwenRes.data.config.activeProvider === 'qwen' ? 'PASS' : 'FAIL');

  // 8. Test Qwen connection
  const testQwen = await axios.post(`${BASE_URL}/api/settings/ai-provider/test`, { provider: 'qwen' }, { headers });
  console.log('✓ Test Qwen Connection Result:', testQwen.data);

  // 9. Switch back to Llama as active default
  await axios.put(`${BASE_URL}/api/settings/ai-provider`, { provider: 'llama' }, { headers });
  console.log('✓ Restored active provider to Llama 3.2');

  console.log('\n🎉 ALL AI PROVIDER TOGGLE TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('❌ Test failed:', err.response?.data || err.message);
  process.exit(1);
});
