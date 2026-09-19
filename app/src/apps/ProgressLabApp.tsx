import React, { useState, useEffect } from 'react';

interface ProgressDelta {
  concept: string;
  before: {
    total: number;
    correct: number;
    accuracy_percent: number;
  };
  after: {
    total: number;
    correct: number;
    accuracy_percent: number;
  };
  mastery_improved: boolean;
}

interface ProgressRecord {
  id: string;
  student_id: string;
  concept: string;
  delta: ProgressDelta;
  created_at: string;
}

interface ProgressLabAppProps {
  studentId: string;
  token: string;
  apiBaseUrl?: string;
}

export const ProgressLabApp: React.FC<ProgressLabAppProps> = ({
  studentId,
  token,
  apiBaseUrl = '/api',
}) => {
  const [records, setRecords] = useState<ProgressRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchProgress();
  }, [studentId]);

  const fetchProgress = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/reassessments/progress/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setRecords(data.progress || []);
    } catch (err) {
      console.error('Failed to load progress', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      {/* Header */}
      <div className="border-b border-neutral-800 pb-4 mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Progress Lab</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Inspectable before / after evidence comparison and delta mastery
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">
          Loading progress evidence...
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 text-center border border-dashed border-neutral-800 rounded-xl p-8">
          <span className="text-2xl mb-2">📈</span>
          <p className="text-base font-semibold text-neutral-300">No Reassessment Progress Yet</p>
          <p className="text-xs text-neutral-500 max-w-md mt-1">
            Complete an intervention practice and reassessment attempt to visualize before and after
            conceptual mastery.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {records.map((rec) => {
            const { before, after, concept } = rec.delta;
            return (
              <div
                key={rec.id}
                className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm"
              >
                <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-5">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-sky-400">
                      Concept Mastery Delta
                    </span>
                    <h3 className="text-lg font-bold text-white mt-0.5">{concept}</h3>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      after.accuracy_percent >= before.accuracy_percent
                        ? 'bg-emerald-950/80 text-emerald-400 border border-emerald-800/60'
                        : 'bg-rose-950/80 text-rose-400 border border-rose-800/60'
                    }`}
                  >
                    {after.accuracy_percent >= before.accuracy_percent
                      ? `+${after.accuracy_percent - before.accuracy_percent}% Delta Gain`
                      : `${after.accuracy_percent - before.accuracy_percent}% Delta`}
                  </span>
                </div>

                {/* Before vs After Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Before Box */}
                  <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/80">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400 block mb-2">
                      Before Intervention
                    </span>
                    <div className="text-3xl font-extrabold text-neutral-200">
                      {before.accuracy_percent}%
                    </div>
                    <div className="text-xs text-neutral-400 mt-2 font-mono">
                      {before.correct} of {before.total} attempts correct
                    </div>
                    <p className="text-xs text-amber-400/90 mt-2 font-medium">
                      Triggered emerging gap alert
                    </p>
                  </div>

                  {/* After Box */}
                  <div className="p-4 rounded-xl bg-neutral-950/80 border border-neutral-800/80">
                    <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400 block mb-2">
                      After Intervention & Reassessment
                    </span>
                    <div className="text-3xl font-extrabold text-emerald-400">
                      {after.accuracy_percent}%
                    </div>
                    <div className="text-xs text-neutral-400 mt-2 font-mono">
                      {after.correct} of {after.total} attempts correct
                    </div>
                    <p className="text-xs text-emerald-300 mt-2 font-medium">
                      Mastery verified with concrete reassessment evidence
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ProgressLabApp;
