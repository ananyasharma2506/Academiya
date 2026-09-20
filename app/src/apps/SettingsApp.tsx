import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import {
  Sun,
  Moon,
  Check,
  Upload,
  Image as ImageIcon,
  RotateCcw,
  Link as LinkIcon,
  Cpu,
  Server,
  Code2,
  Cloud,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Zap
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useOSSettings, WALLPAPER_PRESETS, type FontSize } from '../os/store/useOSSettings';

type AIProviderType = 'llama' | 'qwen' | 'gemini' | 'lmstudio';

interface AIProviderConfig {
  activeProvider: AIProviderType;
  llama?: {
    id: string;
    name: string;
    model: string;
    baseUrl: string;
    timeoutMs: number;
    isLocal: boolean;
    description: string;
  };
  qwen?: {
    id: string;
    name: string;
    model: string;
    baseUrl: string;
    timeoutMs: number;
    isLocal: boolean;
    description: string;
  };
  gemini?: {
    id: string;
    name: string;
    model: string;
    embedModel?: string;
    timeoutMs: number;
    hasKey: boolean;
    isLocal: boolean;
    description: string;
  };
  lmstudio?: {
    name: string;
    baseUrl: string;
    model: string;
    embedModel: string;
    timeoutMs: number;
    isLocal: boolean;
  };
}

export default function SettingsApp() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { fontSize, setFontSize, wallpaper, setWallpaper, resetWallpaper } = useOSSettings();
  const [name, setName] = useState('');
  const [saved, setSaved] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [uploadError, setUploadError] = useState<string | null>(null);

  // AI Provider State
  const [aiConfig, setAiConfig] = useState<AIProviderConfig | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProviderType>('llama');
  const [savingProvider, setSavingProvider] = useState(false);
  const [providerSaved, setProviderSaved] = useState(false);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{
    provider: string;
    success: boolean;
    message?: string;
    latencyMs?: number;
    error?: string;
  } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.name);
    }
  }, [user]);

  // Load AI provider config from backend
  useEffect(() => {
    const fetchAIConfig = async () => {
      try {
        const res = await axios.get('/api/settings/ai-provider');
        if (res.data?.config) {
          setAiConfig(res.data.config);
          const active = res.data.config.activeProvider;
          setSelectedProvider(active === 'lmstudio' ? 'llama' : active);
        }
      } catch (err) {
        console.error('Failed to load AI provider config:', err);
      }
    };
    fetchAIConfig();
  }, []);

  const handleSelectProvider = async (provider: AIProviderType) => {
    setSelectedProvider(provider);
    setSavingProvider(true);
    try {
      const res = await axios.put('/api/settings/ai-provider', { provider });
      if (res.data?.config) {
        setAiConfig(res.data.config);
        const active = res.data.config.activeProvider;
        setSelectedProvider(active === 'lmstudio' ? 'llama' : active);
      }
      setProviderSaved(true);
      setTimeout(() => setProviderSaved(false), 2500);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update AI provider');
    } finally {
      setSavingProvider(false);
    }
  };

  const handleTestConnection = async (e: React.MouseEvent, provider: AIProviderType) => {
    e.stopPropagation();
    setTestingProvider(provider);
    setTestResult(null);
    try {
      const res = await axios.post('/api/settings/ai-provider/test', { provider });
      setTestResult(res.data);
    } catch (err: any) {
      setTestResult({
        provider,
        success: false,
        error: err.response?.data?.error || err.message,
      });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await axios.put('/api/settings/profile', { name });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to update profile');
    }
  };

  // Compress and resize image to fit in localStorage cleanly
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new Image();
      img.onload = () => {
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          setWallpaper(readerEvent.target?.result as string, 'custom');
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        setWallpaper(dataUrl, 'custom');
      };
      img.onerror = () => {
        setUploadError('Failed to parse uploaded image file.');
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = () => {
      setUploadError('Failed to read image file.');
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!customUrlInput.trim()) return;
    setWallpaper(customUrlInput.trim(), 'custom');
    setCustomUrlInput('');
  };

  const previewStyle = useMemo<React.CSSProperties>(() => {
    if (!wallpaper || wallpaper === 'var(--bg-desktop)') {
      return { background: 'linear-gradient(135deg, #1e1b4b 0%, #090d16 100%)' };
    }
    if (
      wallpaper.startsWith('http://') ||
      wallpaper.startsWith('https://') ||
      wallpaper.startsWith('data:image')
    ) {
      return {
        backgroundImage: `linear-gradient(rgba(10, 12, 20, 0.35), rgba(10, 12, 20, 0.55)), url("${wallpaper}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      };
    }
    return { background: wallpaper };
  }, [wallpaper]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 560, width: '100%', margin: '0 auto', paddingBottom: 24 }}>
      <div>
        <h2 style={{ fontSize: 18, fontWeight: 800, margin: 0 }}>System Settings</h2>
        <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
          Account profile, desktop wallpaper, and environment display preferences
        </p>
      </div>

      {/* Account Info */}
      <div className="glass-panel" style={{ borderRadius: 14, padding: 18 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>Account Profile</h3>
        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
              Full Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'var(--input-bg)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-primary)',
                fontSize: 13,
                outline: 'none',
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
              Email Address
            </label>
            <input
              type="email"
              disabled
              value={user?.email || ''}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 8,
                background: 'rgba(0,0,0,0.1)',
                border: '1px solid var(--panel-border)',
                color: 'var(--text-muted)',
                fontSize: 13,
              }}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="submit" className="btn-primary" style={{ padding: '6px 16px', fontSize: 12 }}>
              Save Name
            </button>
            {saved && (
              <span style={{ fontSize: 12, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Check size={13} /> Profile updated!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* AI Model Engine Configuration */}
      <div className="glass-panel" style={{ borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Cpu size={18} color="var(--accent-light, #38bdf8)" />
              <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>AI Intelligence Engine</h3>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0 0' }}>
              Choose your active AI inference model for diagnostic probes, question generation, and pedagogical plans.
            </p>
          </div>
          {providerSaved && (
            <span style={{ fontSize: 11, color: '#34d399', display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(52, 211, 153, 0.1)', padding: '3px 8px', borderRadius: 6, border: '1px solid rgba(52, 211, 153, 0.25)' }}>
              <Check size={12} /> Active Provider Saved
            </span>
          )}
        </div>

        {/* Provider Cards Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
          {/* Llama 3.2 3B Instruct Card */}
          <div
            onClick={() => handleSelectProvider('llama')}
            style={{
              padding: 14,
              borderRadius: 10,
              cursor: 'pointer',
              border: (selectedProvider === 'llama' || selectedProvider === 'lmstudio') ? '2px solid #38bdf8' : '1px solid var(--panel-border)',
              background: (selectedProvider === 'llama' || selectedProvider === 'lmstudio') ? 'rgba(56, 189, 248, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              boxShadow: (selectedProvider === 'llama' || selectedProvider === 'lmstudio') ? '0 0 16px rgba(56, 189, 248, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Server size={15} color="#38bdf8" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Llama 3.2 3B</span>
                </div>
                {(selectedProvider === 'llama' || selectedProvider === 'lmstudio') ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#38bdf8', color: '#090d16' }}>
                    Active
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--panel-border)', padding: '1px 6px', borderRadius: 10 }}>
                    Select
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Fast on-premise local model via LM Studio. Ultra-lightweight (2GB VRAM) for quick diagnostic questions and MCQs.
              </div>
              <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                📍 {aiConfig?.llama?.baseUrl || 'http://localhost:1234/v1'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--panel-border)' }}>
              <span style={{ fontSize: 10, color: '#38bdf8', fontWeight: 600 }}>
                {aiConfig?.llama?.model || 'llama-3.2-3b-instruct'}
              </span>
              <button
                type="button"
                onClick={(e) => handleTestConnection(e, 'llama')}
                disabled={testingProvider === 'llama'}
                className="btn-secondary"
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {testingProvider === 'llama' ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                Test Ping
              </button>
            </div>
          </div>

          {/* Qwen 2.5 Coder 7B Card */}
          <div
            onClick={() => handleSelectProvider('qwen')}
            style={{
              padding: 14,
              borderRadius: 10,
              cursor: 'pointer',
              border: selectedProvider === 'qwen' ? '2px solid #10b981' : '1px solid var(--panel-border)',
              background: selectedProvider === 'qwen' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              boxShadow: selectedProvider === 'qwen' ? '0 0 16px rgba(16, 185, 129, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Code2 size={15} color="#10b981" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Qwen 2.5 Coder</span>
                </div>
                {selectedProvider === 'qwen' ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#10b981', color: '#090d16' }}>
                    Active
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--panel-border)', padding: '1px 6px', borderRadius: 10 }}>
                    Select
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Specialized coding intelligence via LM Studio. Gold standard for Code Lab challenges, Python stubs & test cases.
              </div>
              <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                📍 {aiConfig?.qwen?.baseUrl || 'http://localhost:1234/v1'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--panel-border)' }}>
              <span style={{ fontSize: 10, color: '#10b981', fontWeight: 600 }}>
                {aiConfig?.qwen?.model || 'qwen2.5-coder-7b-instruct'}
              </span>
              <button
                type="button"
                onClick={(e) => handleTestConnection(e, 'qwen')}
                disabled={testingProvider === 'qwen'}
                className="btn-secondary"
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {testingProvider === 'qwen' ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                Test Ping
              </button>
            </div>
          </div>

          {/* Gemini API Card */}
          <div
            onClick={() => handleSelectProvider('gemini')}
            style={{
              padding: 14,
              borderRadius: 10,
              cursor: 'pointer',
              border: selectedProvider === 'gemini' ? '2px solid #a855f7' : '1px solid var(--panel-border)',
              background: selectedProvider === 'gemini' ? 'rgba(168, 85, 247, 0.08)' : 'rgba(255, 255, 255, 0.02)',
              boxShadow: selectedProvider === 'gemini' ? '0 0 16px rgba(168, 85, 247, 0.15)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 12,
              transition: 'all 0.2s ease',
              position: 'relative'
            }}
          >
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Cloud size={15} color="#a855f7" />
                  <span style={{ fontSize: 13, fontWeight: 700 }}>Google Gemini API</span>
                </div>
                {selectedProvider === 'gemini' ? (
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: '#a855f7', color: '#ffffff' }}>
                    Active
                  </span>
                ) : (
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', border: '1px solid var(--panel-border)', padding: '1px 6px', borderRadius: 10 }}>
                    Select
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                Cloud generation with high throughput and extensive context reasoning via Google Generative Language.
              </div>
              <div style={{ marginTop: 8, fontSize: 10, fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                🔑 {aiConfig?.gemini?.hasKey ? 'Configured (API Key Active)' : 'No API Key Set'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: 6, borderTop: '1px solid var(--panel-border)' }}>
              <span style={{ fontSize: 10, color: '#a855f7', fontWeight: 600 }}>
                {aiConfig?.gemini?.model || 'gemini-2.5-flash'}
              </span>
              <button
                type="button"
                onClick={(e) => handleTestConnection(e, 'gemini')}
                disabled={testingProvider === 'gemini'}
                className="btn-secondary"
                style={{ fontSize: 10, padding: '3px 8px', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                {testingProvider === 'gemini' ? <RefreshCw size={10} className="spin" /> : <Zap size={10} />}
                Test Ping
              </button>
            </div>
          </div>
        </div>

        {/* Live Test Feedback Banner */}
        {testResult && (
          <div
            style={{
              padding: '9px 12px',
              borderRadius: 8,
              fontSize: 11,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              background: testResult.success ? 'rgba(52, 211, 153, 0.1)' : 'rgba(239, 68, 68, 0.1)',
              border: `1px solid ${testResult.success ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)'}`,
              color: testResult.success ? '#34d399' : '#f87171',
            }}
          >
            {testResult.success ? (
              <>
                <CheckCircle size={14} style={{ flexShrink: 0 }} />
                <span>
                  <strong>{testResult.provider === 'gemini' ? 'Gemini API' : 'LM Studio'}:</strong> {testResult.message || `Operational (${testResult.latencyMs}ms latency)`}
                </span>
              </>
            ) : (
              <>
                <AlertCircle size={14} style={{ flexShrink: 0 }} />
                <span>
                  <strong>{testResult.provider === 'gemini' ? 'Gemini API' : 'LM Studio'}:</strong> {testResult.error || 'Connection failed'}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Desktop Wallpaper Settings */}
      <div className="glass-panel" style={{ borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Desktop Wallpaper</h3>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0 0' }}>
              Choose a preset or upload your own custom background wallpaper
            </p>
          </div>
          {wallpaper !== 'var(--bg-desktop)' && (
            <button
              type="button"
              onClick={resetWallpaper}
              className="btn-secondary"
              style={{ fontSize: 11, padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: 5, borderRadius: 7 }}
              title="Reset desktop to original cosmic gradient"
            >
              <RotateCcw size={12} /> Reset to Default
            </button>
          )}
        </div>

        {/* Live Wallpaper Preview Card */}
        <div
          style={{
            height: 96,
            borderRadius: 10,
            border: '1px solid var(--panel-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            overflow: 'hidden',
            boxShadow: 'inset 0 0 20px rgba(0, 0, 0, 0.4)',
            transition: 'background 0.3s ease',
            ...previewStyle,
          }}
        >
          <div
            style={{
              padding: '5px 14px',
              borderRadius: 20,
              background: 'rgba(10, 12, 20, 0.75)',
              backdropFilter: 'blur(10px)',
              fontSize: 11,
              fontWeight: 600,
              color: '#fff',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              border: '1px solid rgba(255, 255, 255, 0.1)',
            }}
          >
            <ImageIcon size={13} color="#38bdf8" />
            <span>Active Desktop Wallpaper</span>
          </div>
        </div>

        {/* Curated Presets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Curated Color &amp; Gradient Presets
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(95px, 1fr))', gap: 8 }}>
            {WALLPAPER_PRESETS.map((preset) => {
              const isSelected = wallpaper === preset.value;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => setWallpaper(preset.value, 'preset')}
                  style={{
                    height: 54,
                    borderRadius: 8,
                    background: preset.preview,
                    border: isSelected ? '2px solid #38bdf8' : '1px solid var(--panel-border)',
                    boxShadow: isSelected ? '0 0 14px rgba(56, 189, 248, 0.5)' : 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 4,
                    position: 'relative',
                    transition: 'transform 0.15s ease, box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  title={preset.name}
                >
                  {isSelected && (
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        background: 'rgba(10, 12, 20, 0.85)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid #38bdf8',
                      }}
                    >
                      <Check size={12} color="#38bdf8" strokeWidth={2.5} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom Image Upload & URL Input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 6, borderTop: '1px solid var(--panel-border)' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
            Custom Image Wallpaper
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* File Upload Button */}
            <label
              className="btn-secondary"
              style={{
                fontSize: 11,
                padding: '7px 14px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                borderRadius: 8,
                flexShrink: 0,
              }}
            >
              <Upload size={13} />
              <span>Choose Image File...</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                style={{ display: 'none' }}
              />
            </label>

            {/* URL Input */}
            <div style={{ position: 'relative', flex: 1, minWidth: 200, display: 'flex', gap: 6 }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <LinkIcon
                  size={12}
                  style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
                />
                <input
                  type="url"
                  placeholder="Or paste image URL (https://...)"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleApplyUrl();
                    }
                  }}
                  style={{
                    width: '100%',
                    padding: '6px 10px 6px 28px',
                    borderRadius: 8,
                    background: 'var(--input-bg)',
                    border: '1px solid var(--panel-border)',
                    color: 'var(--text-primary)',
                    fontSize: 11,
                    outline: 'none',
                  }}
                />
              </div>

              <button
                type="button"
                onClick={handleApplyUrl}
                disabled={!customUrlInput.trim()}
                className="btn-primary"
                style={{
                  fontSize: 11,
                  padding: '6px 14px',
                  borderRadius: 8,
                  flexShrink: 0,
                  opacity: customUrlInput.trim() ? 1 : 0.5,
                  cursor: customUrlInput.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Apply
              </button>
            </div>
          </div>

          {uploadError && (
            <div style={{ fontSize: 11, color: '#f87171' }}>{uploadError}</div>
          )}
        </div>
      </div>

      {/* Appearance & Font Settings */}
      <div className="glass-panel" style={{ borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0 }}>Display &amp; Font Scaling</h3>

        {/* Theme Toggle */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Theme Mode</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Toggle between Liquid Glass Dark and Clean Light</div>
          </div>
          <button onClick={toggleTheme} className="btn-secondary" style={{ fontSize: 12, padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 8 }}>
            {theme === 'dark' ? <><Sun size={13} /> Switch to Light</> : <><Moon size={13} /> Switch to Dark</>}
          </button>
        </div>

        {/* Font Size Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>Global Font Scale</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Adjust display typography size</div>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['small', 'medium', 'large'] as FontSize[]).map((sz) => (
              <button
                key={sz}
                onClick={() => setFontSize(sz)}
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  border: fontSize === sz ? '1px solid rgb(var(--accent))' : '1px solid var(--panel-border)',
                  background: fontSize === sz ? 'rgba(var(--accent), 0.2)' : 'transparent',
                  color: fontSize === sz ? 'var(--accent-light)' : 'var(--text-primary)',
                  fontSize: 11,
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                  fontWeight: fontSize === sz ? 700 : 500,
                }}
              >
                {sz}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
