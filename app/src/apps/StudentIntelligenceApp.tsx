import React, { useState, useEffect } from 'react';

interface EvidenceItem {
  id: string;
  student_id: string;
  concept: string;
  subconcept: string;
  attempt_id: string;
  result: 'correct' | 'incorrect';
  created_at: string;
}

interface LearningGap {
  id: string;
  student_id: string;
  concept: string;
  subconcept: string;
  status: 'emerging' | 'confirmed' | 'resolved';
  evidence_ids: string[];
  evidence: EvidenceItem[];
  created_at: string;
  updated_at: string;
}

interface StudentOption {
  id: string;
  name: string;
  email: string;
}

interface StudentIntelligenceAppProps {
  token: string;
  apiBaseUrl?: string;
  studentsList?: StudentOption[];
}

export const StudentIntelligenceApp: React.FC<StudentIntelligenceAppProps> = ({
  token,
  apiBaseUrl = '/api',
  studentsList = [],
}) => {
  const [students, setStudents] = useState<StudentOption[]>(studentsList);
  const [selectedStudentId, setSelectedStudentId] = useState<string>(
    studentsList[0]?.id || ''
  );
  const [gaps, setGaps] = useState<LearningGap[]>([]);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    if (selectedStudentId) {
      fetchStudentGaps(selectedStudentId);
    }
  }, [selectedStudentId]);

  const fetchStudentGaps = async (studentId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/gaps/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setGaps(data.gaps || []);
    } catch (err) {
      console.error('Failed to load student gaps', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-800 pb-4 mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-white tracking-tight">Student Intelligence</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            Concrete evidence inspection and concept-level learning gaps
          </p>
        </div>

        {/* Student Selector */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-neutral-400 font-medium">Select Student:</label>
          <input
            type="text"
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            placeholder="Student UUID..."
            className="bg-neutral-900 border border-neutral-800 text-sm px-3 py-1.5 rounded-lg text-neutral-200 focus:outline-none focus:border-sky-500 w-64"
          />
          <button
            onClick={() => fetchStudentGaps(selectedStudentId)}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold rounded-lg transition"
          >
            Inspect
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      {loading ? (
        <div className="flex items-center justify-center h-48 text-neutral-400 text-sm">
          Inspecting student learning evidence...
        </div>
      ) : gaps.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-56 text-center border border-dashed border-neutral-800 rounded-xl p-8">
          <span className="text-2xl mb-2">🎯</span>
          <p className="text-base font-semibold text-neutral-300">No Learning Gaps Detected</p>
          <p className="text-xs text-neutral-500 max-w-md mt-1">
            Either this student has not produced sufficient evidence, or recent attempts
            demonstrate conceptual mastery.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {gaps.map((gap) => {
            const incorrectCount = gap.evidence.filter((e) => e.result === 'incorrect').length;
            const totalCount = gap.evidence.length;

            return (
              <div
                key={gap.id}
                className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-6 shadow-sm"
              >
                {/* Status Badge & Concept Header - Format strictly matching MASTER_SPEC Section 1.2 */}
                <div className="border-b border-neutral-800/80 pb-4 mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                    <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                      {gap.status === 'emerging' ? 'Emerging difficulty' : `${gap.status} gap`}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white">
                    {gap.concept} {gap.subconcept ? `— ${gap.subconcept}` : ''}
                  </h3>
                </div>

                {/* Evidence Section - Strictly renders evidence, NEVER an opaque percentage score */}
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-neutral-400 mb-3">
                    Evidence
                  </h4>

                  <ul className="space-y-2 text-sm text-neutral-300 font-sans">
                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>
                        <strong className="text-neutral-200">{incorrectCount} recent weak attempts</strong> out of {totalCount} evaluated items on this concept
                      </span>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>
                        Repeated conceptual errors specifically in <span className="text-neutral-200">{gap.subconcept || gap.concept}</span>
                      </span>
                    </li>

                    <li className="flex items-start gap-2">
                      <span className="text-amber-400 font-bold">•</span>
                      <span>Targeted diagnostic intervention candidate</span>
                    </li>
                  </ul>

                  {/* Concrete Traceable Evidence Trails */}
                  <div className="mt-5 pt-4 border-t border-neutral-800/60">
                    <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider block mb-2">
                      Audit Trail ({gap.evidence.length} concrete observations)
                    </span>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-2">
                      {gap.evidence.map((ev, idx) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between text-xs py-1 px-2.5 bg-neutral-950/70 rounded-md border border-neutral-800/50"
                        >
                          <div className="flex items-center gap-2">
                            <span className={ev.result === 'correct' ? 'text-emerald-400' : 'text-rose-400'}>
                              {ev.result === 'correct' ? '✓' : '✗'}
                            </span>
                            <span className="text-neutral-300">
                              Attempt #{idx + 1} ({ev.subconcept})
                            </span>
                          </div>
                          <span className="text-neutral-400 font-mono text-[10px]">
                            {new Date(ev.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      ))}
                    </div>
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

export default StudentIntelligenceApp;
