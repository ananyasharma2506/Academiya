import React, { useState, useEffect } from 'react';

interface ClassInsightsAppProps {
  token: string;
  apiBaseUrl?: string;
}

export const ClassInsightsApp: React.FC<ClassInsightsAppProps> = ({
  token,
  apiBaseUrl = '/api',
}) => {
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchClassInsights();
  }, []);

  const fetchClassInsights = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/insights/class`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setInsights(data.insights || []);
    } catch (err) {
      console.error('Failed to load class insights', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      <div className="border-b border-neutral-800 pb-4 mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Class Insights</h2>
        <p className="text-xs text-neutral-400 mt-0.5">
          Class-wide conceptual gap aggregations derived directly from learning gaps
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">
          Aggregating class insights...
        </div>
      ) : insights.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 text-center border border-dashed border-neutral-800 rounded-xl p-8">
          <p className="text-base font-semibold text-neutral-300">No Class Gaps Detected</p>
          <p className="text-xs text-neutral-500 max-w-md mt-1">
            Students have not triggered concept-level learning gaps.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {insights.map((item, idx) => (
            <div
              key={idx}
              className="p-5 rounded-xl bg-neutral-900/80 border border-neutral-800 flex items-center justify-between"
            >
              <div>
                <span className="text-base font-bold text-white">{item.concept}</span>
                <p className="text-xs text-neutral-400 mt-0.5">{item.subconcept}</p>
                <div className="flex gap-2 mt-2 text-[11px] font-mono">
                  <span className="text-amber-400">Emerging: {item.emerging_count}</span>
                  <span className="text-neutral-500">•</span>
                  <span className="text-emerald-400">Resolved: {item.resolved_count}</span>
                </div>
              </div>

              <div className="text-right">
                <span className="text-2xl font-black text-amber-400">
                  {item.affected_students_count}
                </span>
                <span className="block text-[11px] text-neutral-400 uppercase tracking-wider font-semibold">
                  Students Showing Difficulty
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ClassInsightsApp;
