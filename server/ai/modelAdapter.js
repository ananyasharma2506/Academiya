/**
 * AI Model Adapter
 *
 * Implements bounded AI generation interface with strict fallback shape:
 * 1. Tries local model first (e.g. local Ollama / OpenAI-compatible endpoint with strict timeout).
 * 2. On failure, timeout, or unreachable endpoint, falls back to pre-generated validated pool.
 * 3. All outputs are validated against schema before return.
 */

import { extractJSON } from '../lib/aiOutput.js';
import {
  FALLBACK_QUESTIONS,
  FALLBACK_DIAGNOSTICS,
  FALLBACK_PLANS,
  FALLBACK_EXPLANATIONS,
} from './fallbackPool.js';

const LOCAL_MODEL_URL = process.env.LOCAL_MODEL_URL || 'http://127.0.0.1:11434/api/generate';
const LOCAL_MODEL_NAME = process.env.LOCAL_MODEL_NAME || 'deepseek-coder-v2:16b';
const TIMEOUT_MS = parseInt(process.env.AI_TIMEOUT_MS || '3500', 10);

/**
 * Call local LLM with timeout. Rejects if timeout or network failure occurs.
 */
async function callLocalLLM(prompt) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(LOCAL_MODEL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: LOCAL_MODEL_NAME,
        prompt,
        stream: false,
        format: 'json',
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      throw new Error(`Local model responded with status ${res.status}`);
    }

    const json = await res.json();
    return json.response || json.text || JSON.stringify(json);
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

/**
 * Validates a generated question object.
 */
export function validateQuestion(q, blueprint = {}) {
  if (!q || typeof q !== 'object') throw new Error('Question must be an object');
  if (!q.statement || typeof q.statement !== 'string' || q.statement.trim().length === 0) {
    throw new Error('Question statement is missing or invalid');
  }
  if (!Array.isArray(q.options) || q.options.length < 2) {
    throw new Error('Question options must be an array with at least 2 options');
  }
  if (!Array.isArray(q.correct_option_ids) || q.correct_option_ids.length === 0) {
    throw new Error('Question correct_option_ids must be a non-empty array');
  }

  const type = q.type || blueprint.type || 'mcq_single';
  if (type === 'mcq_single' && q.correct_option_ids.length !== 1) {
    throw new Error('mcq_single must have exactly one correct option');
  }

  const optionIds = new Set(q.options.map((o) => o.id));
  for (const cid of q.correct_option_ids) {
    if (!optionIds.has(cid)) {
      throw new Error(`correct_option_id ${cid} does not exist in options`);
    }
  }

  return {
    concept: blueprint.concept || q.concept || 'General',
    subconcept: blueprint.subconcept || q.subconcept || 'Core Concepts',
    type,
    statement: q.statement.trim(),
    options: q.options,
    correct_option_ids: q.correct_option_ids,
    bloom_level: blueprint.bloom_level || q.bloom_level || 'understand',
    difficulty: blueprint.difficulty || q.difficulty || 'medium',
  };
}

/**
 * Generates a question from a structured blueprint.
 * Tries local model first -> falls back to validated pool.
 */
export async function generateQuestion(blueprint) {
  const prompt = `You are a curriculum assessment generator.
Create one multiple choice question based strictly on this blueprint:
Concept: ${blueprint.concept}
Subconcept: ${blueprint.subconcept}
Type: ${blueprint.type || 'mcq_single'}
Bloom Level: ${blueprint.bloom_level || 'understand'}
Difficulty: ${blueprint.difficulty || 'medium'}
Constraints: ${JSON.stringify(blueprint.constraints || {})}

Return pure JSON only in this exact format:
{
  "statement": "string",
  "options": [
    { "id": "opt_1", "text": "option 1" },
    { "id": "opt_2", "text": "option 2" },
    { "id": "opt_3", "text": "option 3" },
    { "id": "opt_4", "text": "option 4" }
  ],
  "correct_option_ids": ["opt_2"]
}`;

  try {
    const rawOutput = await callLocalLLM(prompt);
    const parsed = extractJSON(rawOutput);
    return validateQuestion(parsed, blueprint);
  } catch {
    // Fallback: Pick from pre-generated validated pool
    const pool = FALLBACK_QUESTIONS[blueprint.concept] || FALLBACK_QUESTIONS.default;
    const item = pool[Math.floor(Math.random() * pool.length)];
    return validateQuestion(
      {
        ...item,
        concept: blueprint.concept || item.concept,
        subconcept: blueprint.subconcept || item.subconcept,
        type: blueprint.type || item.type,
      },
      blueprint
    );
  }
}

/**
 * Generates a diagnostic blueprint for a learning gap.
 */
export async function generateDiagnostic(gap) {
  try {
    const prompt = `Generate a diagnostic blueprint for this learning gap:
Concept: ${gap.concept}
Subconcept: ${gap.subconcept}
Triggering Evidence: ${JSON.stringify(gap.evidence || [])}

Return pure JSON with focus_concept, isolated_misconception, recommended_probes, and probe_questions.`;

    const rawOutput = await callLocalLLM(prompt);
    return extractJSON(rawOutput);
  } catch {
    return FALLBACK_DIAGNOSTICS[gap.concept] || {
      focus_concept: gap.concept,
      isolated_misconception: `Systematic errors in ${gap.subconcept || gap.concept}`,
      recommended_probes: ['Targeted evaluation of edge cases and fundamental properties'],
      probe_questions: (FALLBACK_QUESTIONS[gap.concept] || FALLBACK_QUESTIONS.default).slice(0, 1),
    };
  }
}

/**
 * Generates an intervention learning plan.
 */
export async function generatePlan(gap, diagnosticResults = null) {
  try {
    const prompt = `Generate a targeted intervention learning plan:
Concept: ${gap.concept}
Subconcept: ${gap.subconcept}
Diagnostic: ${JSON.stringify(diagnosticResults || {})}

Return pure JSON with target_concept, summary, steps, and practice_count.`;

    const rawOutput = await callLocalLLM(prompt);
    return extractJSON(rawOutput);
  } catch {
    return FALLBACK_PLANS[gap.concept] || {
      target_concept: gap.concept,
      summary: `Targeted remediation plan for ${gap.concept}`,
      steps: [
        { step: 1, title: 'Concept review', description: `Review fundamentals of ${gap.concept}` },
        { step: 2, title: 'Targeted Practice', description: 'Complete 3 guided practice exercises' },
      ],
      practice_count: 3,
    };
  }
}

/**
 * Generates a targeted concept explanation for a mistake.
 */
export async function generateExplanation(question, attempt) {
  try {
    const prompt = `Explain why the student's answer was incorrect:
Question: ${question.statement}
Selected: ${JSON.stringify(attempt.selected_option_ids)}
Correct: ${JSON.stringify(question.correct_option_ids)}

Return pure JSON with explanation string.`;

    const rawOutput = await callLocalLLM(prompt);
    const parsed = extractJSON(rawOutput);
    return typeof parsed === 'string' ? parsed : parsed.explanation || JSON.stringify(parsed);
  } catch {
    return (
      FALLBACK_EXPLANATIONS[question.concept] ||
      `Review ${question.concept}: verify all constraints and step-by-step logic.`
    );
  }
}

export default {
  generateQuestion,
  generateDiagnostic,
  generatePlan,
  generateExplanation,
  validateQuestion,
};
