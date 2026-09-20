import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import {
  getActiveProvider,
  setActiveProvider,
  getProvidersConfig,
  testProviderConnection
} from '../ai/modelAdapter.js';

const router = express.Router();

router.get('/profile', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [req.user.id]);
    return res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Settings get error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }
    const result = await query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, name, email, role, created_at',
      [name.trim(), req.user.id]
    );
    return res.json({ profile: result.rows[0] });
  } catch (err) {
    console.error('Settings put error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ── AI Provider Configuration ────────────────────────────────────────────────

router.get('/ai-provider', requireAuth, async (req, res) => {
  try {
    const config = getProvidersConfig();
    return res.json({ success: true, config });
  } catch (err) {
    console.error('Failed to get AI provider config:', err);
    return res.status(500).json({ error: 'Failed to get AI provider configuration' });
  }
});

router.put('/ai-provider', requireAuth, async (req, res) => {
  try {
    const { provider } = req.body;
    const validProviders = ['llama', 'qwen', 'gemini', 'lmstudio'];
    if (!validProviders.includes(provider)) {
      return res.status(400).json({ error: "Invalid provider. Must be 'llama', 'qwen', or 'gemini'." });
    }

    const normalized = provider === 'lmstudio' ? 'llama' : provider;

    // Update in-process adapter
    setActiveProvider(normalized);

    // Persist to PostgreSQL system_settings table
    await query(
      `INSERT INTO system_settings (key, value, updated_at)
       VALUES ('ai_provider', $1::jsonb, CURRENT_TIMESTAMP)
       ON CONFLICT (key) DO UPDATE
       SET value = EXCLUDED.value, updated_at = CURRENT_TIMESTAMP`,
      [JSON.stringify({ provider: normalized, updatedBy: req.user.id })]
    );

    const config = getProvidersConfig();
    const providerNames = {
      llama: 'Llama 3.2 3B Instruct (LM Studio)',
      qwen: 'Qwen 2.5 Coder 7B (LM Studio)',
      gemini: 'Google Gemini API'
    };

    return res.json({
      success: true,
      message: `Active AI provider set to ${providerNames[normalized] || normalized}`,
      config
    });
  } catch (err) {
    console.error('Failed to update AI provider:', err);
    return res.status(500).json({ error: 'Failed to update AI provider' });
  }
});

router.post('/ai-provider/test', requireAuth, async (req, res) => {
  try {
    const { provider } = req.body;
    const targetProvider = provider || getActiveProvider();
    const result = await testProviderConnection(targetProvider);
    return res.json(result);
  } catch (err) {
    console.error('Failed to test AI provider:', err);
    return res.status(500).json({ success: false, error: err.message });
  }
});

export default router;

