import React, { useState, useEffect } from 'react';

interface MyLearningAppProps {
  studentId: string;
  token: string;
  apiBaseUrl?: string;
}

export const MyLearningApp: React.FC<MyLearningAppProps> = ({
  studentId,
  token,
  apiBaseUrl = '/api',
}) => {
  const [gaps, setGaps] = useState<any[]>([]);
  const [progress, setProgress] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    loadCockpit();
  }, [studentId]);

  const loadCockpit = async () => {
    setLoading(true);
    try {
      const [gapsRes, progRes] = await Promise.all([
        fetch(`${apiBaseUrl}/gaps/${studentId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${apiBaseUrl}/reassessments/progress/${studentId}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const gapsData = await gapsRes.json();
      const progData = await progRes.json();

      setGaps(gapsData.gaps || []);
      setProgress(progData.progress || []);
    } catch (err) {
      console.error('Failed to load student cockpit', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      <div className="border-b border-neutral-800 pb-4 mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">My Learning Cockpit</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Unified personal learning summary: active challenges, interventions, and verified progress
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">
          Loading learning cockpit...
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Gaps / Areas for Focus */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-3">
              Areas For Attention ({gaps.filter(g => g.status !== 'resolved').length})
            </h3>
            {gaps.filter(g => g.status !== 'resolved').length === 0 ? (
              <p className="text-xs text-neutral-400">All current concepts are on track!</p>
            ) : (
              <div className="space-y-2">
                {gaps.filter(g => g.status !== 'resolved').map((gap) => (
                  <div key={gap.id} className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                    <div>
                      <span className="text-sm font-bold text-neutral-200">{gap.concept}</span>
                      <p className="text-xs text-neutral-400">{gap.subconcept}</p>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded bg-amber-950/60 text-amber-300 border border-amber-800/50">
                      {gap.status}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress / Verified Mastery */}
          <div className="bg-neutral-900/70 border border-neutral-800 rounded-xl p-5">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400 mb-3">
              Verified Progress ({progress.length})
            </h3>
            {progress.length === 0 ? (
              <p className="text-xs text-neutral-400">No reassessment progress recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {progress.map((p) => (
                  <div key={p.id} className="p-3 bg-neutral-950/80 rounded-lg border border-neutral-800/80 flex items-center justify-between">
                    <span className="text-sm font-bold text-neutral-200">{p.concept}</span>
                    <span className="text-xs font-mono font-bold text-emerald-400">
                      {p.delta?.before?.accuracy_percent}% → {p.delta?.after?.accuracy_percent}% (+{p.delta?.after?.accuracy_percent - p.delta?.before?.accuracy_percent}%)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLearningApp;
