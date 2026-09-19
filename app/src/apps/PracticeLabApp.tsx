import React, { useState, useEffect } from 'react';

interface Question {
  id: string;
  concept: string;
  subconcept: string;
  type: string;
  statement: string;
  options: Array<{ id: string; text: string }>;
  difficulty: string;
  bloom_level: string;
  last_attempt_correct?: boolean;
}

interface PracticeLabAppProps {
  studentId: string;
  token: string;
  apiBaseUrl?: string;
}

export const PracticeLabApp: React.FC<PracticeLabAppProps> = ({
  studentId,
  token,
  apiBaseUrl = '/api',
}) => {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(0);
  const [selectedOptionIds, setSelectedOptionIds] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [lastFeedback, setLastFeedback] = useState<{
    is_correct: boolean;
    marks_awarded: number;
  } | null>(null);

  useEffect(() => {
    fetchQuestions();
  }, [studentId]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${apiBaseUrl}/practice/${studentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setQuestions(data.questions || []);
      setCurrentIndex(0);
      setLastFeedback(null);
      setSelectedOptionIds([]);
    } catch (err) {
      console.error('Failed to load practice questions', err);
    } finally {
      setLoading(false);
    }
  };

  const currentQuestion = questions[currentIndex];

  const handleOptionToggle = (optId: string) => {
    if (!currentQuestion) return;
    if (currentQuestion.type === 'mcq_single') {
      setSelectedOptionIds([optId]);
    } else {
      setSelectedOptionIds((prev) =>
        prev.includes(optId) ? prev.filter((id) => id !== optId) : [...prev, optId]
      );
    }
  };

  const handleSubmitAttempt = async () => {
    if (!currentQuestion || selectedOptionIds.length === 0 || submitting) return;

    setSubmitting(true);
    try {
      const res = await fetch(`${apiBaseUrl}/attempts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          question_id: currentQuestion.id,
          selected_option_ids: selectedOptionIds,
          source: 'practice',
        }),
      });
      const data = await res.json();
      if (data.evaluation) {
        setLastFeedback({
          is_correct: data.evaluation.is_correct,
          marks_awarded: data.evaluation.marks_awarded,
        });
      }
    } catch (err) {
      console.error('Failed to submit attempt', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    setLastFeedback(null);
    setSelectedOptionIds([]);
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-neutral-400">
        Loading practice questions...
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-neutral-300">
        <p className="text-lg font-medium">No practice questions available.</p>
        <p className="text-sm text-neutral-500 mt-2">
          Your teacher has not seeded questions or generated practice items yet.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-neutral-950 text-neutral-100 p-6 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 mb-6">
        <div>
          <span className="text-xs uppercase tracking-wider font-semibold text-sky-400">
            {currentQuestion.concept} • {currentQuestion.subconcept}
          </span>
          <h2 className="text-xl font-bold text-white mt-1">Practice Lab</h2>
        </div>
        <div className="text-sm font-mono text-neutral-400 bg-neutral-900 px-3 py-1 rounded-full border border-neutral-800">
          Question {currentIndex + 1} of {questions.length}
        </div>
      </div>

      {/* Question Statement */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-6 mb-6 shadow-md">
        <p className="text-lg font-medium leading-relaxed text-neutral-100">
          {currentQuestion.statement}
        </p>
      </div>

      {/* Options */}
      <div className="space-y-3 mb-6">
        {currentQuestion.options?.map((opt) => {
          const isSelected = selectedOptionIds.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => handleOptionToggle(opt.id)}
              disabled={submitting || lastFeedback !== null}
              className={`w-full text-left p-4 rounded-xl border transition-all flex items-center gap-4 ${
                isSelected
                  ? 'border-sky-500 bg-sky-500/10 text-white font-medium shadow-sm'
                  : 'border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 text-neutral-300'
              }`}
            >
              <div
                className={`w-5 h-5 rounded flex items-center justify-center border text-xs ${
                  isSelected
                    ? 'border-sky-500 bg-sky-500 text-black font-bold'
                    : 'border-neutral-700 bg-neutral-800'
                }`}
              >
                {isSelected ? '✓' : ''}
              </div>
              <span>{opt.text}</span>
            </button>
          );
        })}
      </div>

      {/* Feedback Banner */}
      {lastFeedback && (
        <div
          className={`p-4 rounded-xl border mb-6 flex items-center justify-between ${
            lastFeedback.is_correct
              ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/50 text-rose-300'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-lg">{lastFeedback.is_correct ? '✅' : '❌'}</span>
            <span className="font-semibold">
              {lastFeedback.is_correct
                ? 'Correct! Evidence recorded.'
                : 'Incorrect. Attempt recorded into learning evidence.'}
            </span>
          </div>
          {currentIndex < questions.length - 1 ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg text-sm font-medium transition"
            >
              Next Question →
            </button>
          ) : (
            <span className="text-xs text-neutral-400">All questions completed</span>
          )}
        </div>
      )}

      {/* Action Footer */}
      {!lastFeedback && (
        <div className="mt-auto pt-4 flex justify-end">
          <button
            onClick={handleSubmitAttempt}
            disabled={selectedOptionIds.length === 0 || submitting}
            className={`px-6 py-2.5 rounded-xl text-sm font-semibold transition ${
              selectedOptionIds.length === 0 || submitting
                ? 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                : 'bg-sky-500 hover:bg-sky-400 text-black shadow-lg shadow-sky-500/20'
            }`}
          >
            {submitting ? 'Evaluating...' : 'Submit Answer'}
          </button>
        </div>
      )}
    </div>
  );
};

export default PracticeLabApp;
