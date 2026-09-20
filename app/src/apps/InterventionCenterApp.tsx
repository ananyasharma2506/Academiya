import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Target, ClipboardList } from 'lucide-react';

export default function InterventionCenterApp() {
  const [allGaps, setAllGaps] = useState<any[]>([]);
  const [selectedGapId, setSelectedGapId] = useState<string>('');
  const [intervention, setIntervention] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
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
    axios.get(`/api/interventions/gap/${selectedGapId}`)
      .then(res => setIntervention(res.data.intervention))
      .catch(() => setIntervention(null))
      .finally(() => setLoading(false));
  }, [selectedGapId]);

  const handleCreateIntervention = async () => {
    if (!selectedGapId) return;
    setGenerating(true);
    try {
      const res = await axios.post('/api/interventions', { gap_id: selectedGapId });
      setIntervention(res.data.intervention);
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to create intervention');
    } finally {
      setGenerating(false);
    }
  };

  const selectedGap = allGaps.find(g => g.id === selectedGapId);
  const plan = intervention ? (typeof intervention.plan === 'string' ? JSON.parse(intervention.plan) : intervention.plan) : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, height: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--panel-border)', paddingBottom: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 800 }}>Intervention Center</h2>
          <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
            Targeted pedagogical remediation and scaffolded practice generation.
          </p>
        </div>

        {/* Gap Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, fontWeight: 600 }}>Target Learning Gap:</label>
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
                {g.student_name} — {g.concept} [{g.status}]
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
        {selectedGap && (
          <div className="glass-panel" style={{ borderRadius: 14, padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{selectedGap.concept}</h3>
                <span className={`badge badge-${selectedGap.status}`}>{selectedGap.status}</span>
              </div>
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                Target Student: {selectedGap.student_name}
              </p>
            </div>

            <button
              onClick={handleCreateIntervention}
              disabled={generating}
              className="btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {generating ? (
                <>
                  <Target size={14} className="animate-spin" /> Formulating Plan...
                </>
              ) : (
                <>
                  <ClipboardList size={14} /> Create Targeted Intervention
                </>
              )}
            </button>
          </div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>
            Loading intervention data...
          </div>
        ) : intervention && plan ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Plan Overview */}
            <div className="glass-panel" style={{ borderRadius: 14, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <h3 style={{ fontSize: 16, fontWeight: 700 }}>{plan.title || 'Remedial Learning Plan'}</h3>
                <span className={`badge badge-${intervention.status}`}>{intervention.status}</span>
              </div>
              <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6, lineHeight: '1.5' }}>
                {plan.description}
              </p>
            </div>

            {/* Steps */}
            <div className="glass-panel" style={{ borderRadius: 14, padding: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: 12 }}>
                Scaffolded Remedial Steps:
              </div>
              <div className="stagger-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {plan.steps?.map((st: any, sIdx: number) => (
                  <div
                    key={sIdx}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 12,
                      background: 'var(--card-bg)',
                      padding: 12,
                      borderRadius: 10,
                      border: '1px solid var(--card-border)',
                    }}
                  >
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: '50%',
                        background: 'var(--accent-gradient)',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        fontSize: 12,
                        flexShrink: 0,
                      }}
                    >
                      {st.step || sIdx + 1}
                    </div>
                    <div>
                      <h4 style={{ fontSize: 13, fontWeight: 700 }}>{st.title}</h4>
                      <p style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{st.instructions}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>
            No active intervention formulated yet for this gap. Click "Create Targeted Intervention" above.
          </div>
        )}
      </div>
    </div>
  );
}
