import React, { useState, useEffect } from 'react';

interface CodingChallenge {
  id: string;
  concept: string;
  subconcept: string;
  title: string;
  description: string;
  expected_behaviour: string;
  starter_code: Record<string, string>;
  test_cases: Array<{ id: string; input: string; expected_output: string; is_hidden: boolean }>;
}

interface CodeLabAppProps {
  token: string;
  apiBaseUrl?: string;
}

export const CodeLabApp: React.FC<CodeLabAppProps> = ({
  token,
  apiBaseUrl = '/api',
}) => {
  const [challenges, setChallenges] = useState<CodingChallenge[]>([]);
  const [activeChallenge, setActiveChallenge] = useState<CodingChallenge | null>(null);
  const [code, setCode] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [output, setOutput] = useState<string>('');
  const [running, setRunning] = useState<boolean>(false);
  const [explanation, setExplanation] = useState<string | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      const res = await fetch(`${apiBaseUrl}/code-lab/challenges`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      const list = data.challenges || [];
      setChallenges(list);
      if (list.length > 0) {
        selectChallenge(list[0]);
      }
    } catch (err) {
      console.error('Failed to load challenges', err);
    }
  };

  const selectChallenge = (ch: CodingChallenge) => {
    setActiveChallenge(ch);
    const starter = ch.starter_code?.[language] || '# Write your solution here\n';
    setCode(starter);
    setOutput('');
    setExplanation(null);
  };

  const handleRunCode = async () => {
    if (!activeChallenge || running) return;

    setRunning(true);
    setOutput('Running local execution against test cases...');
    setExplanation(null);

    try {
      const res = await fetch(`${apiBaseUrl}/code-lab/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          challenge_id: activeChallenge.id,
          code,
          language,
        }),
      });
      const data = await res.json();
      const { evaluation, is_passed, explanation: aiExp } = data;

      let msg = `Test Cases Result: ${is_passed ? 'PASSED ✅' : 'FAILED ❌'}\n`;
      msg += `Visible cases: ${evaluation?.visible_cases_passed} / ${evaluation?.visible_cases_total}\n`;
      msg += `Hidden cases: ${evaluation?.hidden_cases_passed} / ${evaluation?.hidden_cases_total}\n`;
      msg += `Marks awarded: ${evaluation?.marks_awarded}`;
      setOutput(msg);

      if (aiExp) {
        setExplanation(aiExp);
      }
    } catch (err: any) {
      setOutput(`Error running code: ${err.message}`);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex h-full bg-neutral-950 text-neutral-100 overflow-hidden">
      {/* Sidebar / Challenge Picker */}
      <div className="w-72 border-r border-neutral-800 p-4 flex flex-col">
        <h2 className="text-sm font-bold uppercase tracking-wider text-sky-400 mb-3">
          Coding Challenges
        </h2>
        <div className="space-y-1.5 overflow-y-auto flex-1 pr-1">
          {challenges.map((c) => (
            <button
              key={c.id}
              onClick={() => selectChallenge(c)}
              className={`w-full text-left p-2.5 rounded-lg text-xs transition border ${
                activeChallenge?.id === c.id
                  ? 'bg-neutral-800 border-sky-500/50 text-white font-medium'
                  : 'bg-neutral-900/50 border-neutral-800/80 text-neutral-400 hover:text-neutral-200'
              }`}
            >
              <span className="block font-semibold text-neutral-200">{c.title}</span>
              <span className="text-[10px] text-neutral-400">{c.concept}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Editor & Output View */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Challenge Header */}
        <div className="p-4 border-b border-neutral-800 bg-neutral-900/40 flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-white">{activeChallenge?.title || 'Code Lab'}</h3>
            <p className="text-xs text-neutral-400 mt-0.5">{activeChallenge?.expected_behaviour}</p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-neutral-800 text-xs px-2.5 py-1.5 rounded-lg border border-neutral-700 text-neutral-200"
            >
              <option value="python">Python 3</option>
              <option value="cpp">C++</option>
              <option value="c">C</option>
            </select>
            <button
              onClick={handleRunCode}
              disabled={running}
              className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold shadow transition"
            >
              {running ? 'Running...' : 'Run Code'}
            </button>
          </div>
        </div>

        {/* Code Editor TextArea */}
        <div className="flex-1 p-2 bg-neutral-950 font-mono text-xs">
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full h-full bg-neutral-900/90 text-neutral-200 p-3 rounded-lg border border-neutral-800 focus:outline-none focus:border-sky-500 font-mono leading-5 resize-none"
            spellCheck={false}
          />
        </div>

        {/* Output & AI Explanation Panel */}
        <div className="h-44 border-t border-neutral-800 bg-neutral-950 p-3 flex flex-col font-mono text-xs">
          <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider mb-1">
            Execution Console
          </span>
          <pre className="flex-1 bg-black/60 p-2.5 rounded border border-neutral-900 overflow-y-auto text-neutral-300">
            {output || 'Output will appear here after execution.'}
          </pre>
          {explanation && (
            <div className="mt-2 p-2 bg-sky-950/40 border border-sky-800/60 rounded text-sky-200 text-xs font-sans">
              <span className="font-bold block mb-0.5">AI Explanation:</span>
              {explanation}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CodeLabApp;
