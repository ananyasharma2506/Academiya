import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Microscope, Check } from 'lucide-react';
import { useOSStore } from '../os/store/useOSStore';

export default function DiagnosticLabApp() {
  const { windows } = useOSStore();
  const [allGaps, setAllGaps] = useState<any[]>([]);
  const [selectedGapId, setSelectedGapId] = useState<string>('');
  const [diagnostic, setDiagnostic] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    // Fetch all active gaps
    axios.get('/api/gaps')
      .then(res => {
        setAllGaps(res.data.gaps);
        if (res.data.gaps.length > 0) {
          setSelectedGapId(res.data.gaps[0].id);
        }
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedGapId) return;
    setLoading(true);
    axios.get(`/api/diagnostics/gap/${selectedGapId}`)
      .then(res => setDiagnostic(res.data.diagnostic))
      .catch(() => setDiagnostic(null))
      .finally(() => setLoading(false));
  }, [selectedGapId]);

  const handleLaunchDiagnostic = async () => {
    if (!selectedGapId) return;
    setRunning(true);
    try {
      const res = await axios.post('/api/diagnostics', { gap_id: selectedGapId });
      setDiagnostic(res.data.diagnostic);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to launch diagnostic');
    } finally {
      setRunning(false);
    }
  };

  const selectedGap = allGaps.find(g => g.id === selectedGapId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--panel-border)', paddingBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Diagnostic Lab</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Targeted misconception probing without opaque risk scores.
          </p>
        </div>

        {/* Gap Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Select Target Gap:</label>
          <select
            value={selectedGapId}
            onChange={(e) => setSelectedGapId(e.target.value)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: 'var(--input-bg)',
              color: 'var(--text-primary)',
              border: '1px solid var(--panel-border)',
              fontSize: 12,
              outline: 'none',
              cursor: 'pointer',
            }}
          >
            {allGaps.map((g) => (
              <option key={g.id} value={g.id} style={{ background: '#1e293b', color: 'white' }}>
                {g.student_name} — {g.concept} ({g.subconcept}) [{g.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Action / Blueprint area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedGap && (
          <div className="glass-panel" style={{ borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedGap.concept}</h3>
                <span className={`badge badge-${selectedGap.status}`}>{selectedGap.status}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Student: {selectedGap.student_name} ({selectedGap.student_email})
              </p>
            </div>

            <button
              onClick={handleLaunchDiagnostic}
              disabled={running}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {running ? (
                <>
                  <Microscope size={14} className="animate-spin" /> Formulating Probe...
                </>
              ) : (
                <>
                  <Microscope size={14} /> Launch Targeted Diagnostic
                </>
              )}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Checking diagnostic history...
          </div>
        ) : diagnostic ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Misconception Diagnosis Box */}
            <div
              className="glass-panel"
              style={{
                borderRadius: 14,
                padding: 16,
                borderLeft: '4px solid #f87171',
                background: 'rgba(239, 68, 68, 0.06)',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 700, color: '#f87171', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Identified Conceptual Misconception:
              </div>
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: 4, color: 'var(--text-primary)' }}>
                "{diagnostic.blueprint?.misconception || 'Deep structural confusion regarding loop termination vs recursive stack reduction'}"
              </div>
            </div>

            {/* Targeted Probe Questions */}
            <div className="glass-panel stagger-fade-in" style={{ borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 10 }}>
                Diagnostic Probe Blueprint:
              </div>

              {diagnostic.blueprint?.blueprint?.targeted_questions?.map((tq: any, qIdx: number) => (
                <div
                  key={qIdx}
                  style={{
                    background: 'var(--card-bg)',
                    borderRadius: 10,
                    padding: 12,
                    marginBottom: 8,
                    border: '1px solid var(--card-border)',
                  }}
                >
                  <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 8 }}>
                    Probe {qIdx + 1}: {tq.statement}
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                    {tq.options?.map((opt: any) => (
                      <div
                        key={opt.id}
                        style={{
                          fontSize: 11,
                          padding: '6px 10px',
                          borderRadius: 6,
                          background: tq.correct_option_ids?.includes(opt.id)
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(255, 255, 255, 0.05)',
                          border: tq.correct_option_ids?.includes(opt.id)
                            ? '1px solid rgba(16, 185, 129, 0.4)'
                            : '1px solid var(--panel-border)',
                          color: tq.correct_option_ids?.includes(opt.id)
                            ? '#34d399'
                            : 'var(--text-secondary)',
                        }}
                      >
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {opt.text} {tq.correct_option_ids?.includes(opt.id) && <Check size={12} />}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No diagnostic has been executed yet for this learning gap. Click "Launch Targeted Diagnostic" above.
          </div>
        )}
      </div>
    </div>
  );
}
