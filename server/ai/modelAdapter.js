/**
 * Central AI Model Adapter
 * Interface: generateQuestion, generateDiagnostic, generatePlan, generateExplanation,
 *            grade_descriptive_answer, generateEmbedding
 *
 * Strict Pattern:
 * Tries local LM Studio first (Gemma e4b via its OpenAI-compatible endpoint, strict timeout)
 * -> on failure/timeout falls back to the Gemini API -> on failure falls back to a
 * pre-validated pool / deterministic heuristic. AI output is always a proposal; it is
 * never trusted without passing the caller's own schema validation.
 */

import axios from 'axios';
import { extractJSON } from '../lib/aiOutput.js';
import { runLocally } from '../lib/localRunner.js';
import { FALLBACK_QUESTIONS, FALLBACK_DIAGNOSTICS, FALLBACK_PLANS, buildFallbackDescriptive, buildFallbackChallenge, FALLBACK_CHALLENGES } from './fallbackPool.js';
export { buildFallbackChallenge, FALLBACK_CHALLENGES };
import { query } from '../db/index.js';

const LMSTUDIO_BASE_URL = process.env.LMSTUDIO_BASE_URL || 'http://localhost:1234/v1';
const LMSTUDIO_LLAMA_MODEL = process.env.LMSTUDIO_LLAMA_MODEL || 'llama-3.2-3b-instruct';
const LMSTUDIO_QWEN_MODEL = process.env.LMSTUDIO_QWEN_MODEL || 'qwen2.5-coder-7b-instruct';
const LMSTUDIO_EMBED_MODEL = process.env.LMSTUDIO_EMBED_MODEL || 'text-embedding-nomic-embed-text-v1.5';
const LMSTUDIO_TIMEOUT_MS = Number(process.env.LMSTUDIO_TIMEOUT_MS) || 75000;

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GEMINI_EMBED_MODEL = process.env.GEMINI_EMBED_MODEL || 'gemini-embedding-001';
const GEMINI_TIMEOUT_MS = Number(process.env.GEMINI_TIMEOUT_MS) || 9000;

// Configurable active provider: 'llama' | 'qwen' | 'gemini' (or 'lmstudio' backwards-compatible)
let activeProvider = process.env.ACTIVE_AI_PROVIDER || 'llama';
if (activeProvider === 'lmstudio') activeProvider = 'llama';

export function getModelForProvider(provider = activeProvider) {
  if (provider === 'qwen') return LMSTUDIO_QWEN_MODEL;
  if (provider === 'llama') return LMSTUDIO_LLAMA_MODEL;
  return LMSTUDIO_LLAMA_MODEL;
}

// Asynchronously load stored provider from system_settings if present
async function loadPersistedProvider() {
  try {
    const res = await query("SELECT value FROM system_settings WHERE key = 'ai_provider'");
    if (res.rows.length > 0 && res.rows[0].value?.provider) {
      const stored = res.rows[0].value.provider;
      activeProvider = stored === 'lmstudio' ? 'llama' : stored;
    }
  } catch {
    // Graceful fallback if database table not yet populated
  }
}
loadPersistedProvider();

export function getActiveProvider() {
  return activeProvider;
}

export function setActiveProvider(provider) {
  const normalized = provider === 'lmstudio' ? 'llama' : provider;
  if (!['llama', 'qwen', 'gemini'].includes(normalized)) {
    throw new Error(`Invalid provider: ${provider}. Must be 'llama', 'qwen', or 'gemini'.`);
  }
  activeProvider = normalized;
  return activeProvider;
}

export function getProvidersConfig() {
  return {
    activeProvider,
    llama: {
      id: 'llama',
      name: 'Llama 3.2 3B Instruct',
      baseUrl: LMSTUDIO_BASE_URL,
      model: LMSTUDIO_LLAMA_MODEL,
      timeoutMs: 45000,
      isLocal: true,
      description: 'Ultra-fast, lightweight on-premise inference via LM Studio. Excellent for quick diagnostic questions and MCQs.'
    },
    qwen: {
      id: 'qwen',
      name: 'Qwen 2.5 Coder 7B',
      baseUrl: LMSTUDIO_BASE_URL,
      model: LMSTUDIO_QWEN_MODEL,
      timeoutMs: LMSTUDIO_TIMEOUT_MS,
      isLocal: true,
      description: 'Code-specialized local intelligence via LM Studio. Gold standard for coding challenges and unit-test validation.'
    },
    gemini: {
      id: 'gemini',
      name: 'Google Gemini API',
      model: GEMINI_MODEL,
      embedModel: GEMINI_EMBED_MODEL,
      timeoutMs: GEMINI_TIMEOUT_MS,
      hasKey: Boolean(GEMINI_API_KEY),
      isLocal: false,
      description: 'Cloud generation with high throughput and broad context reasoning via Google Generative Language.'
    },
    // Backwards compatibility alias
    lmstudio: {
      name: activeProvider === 'qwen' ? 'Qwen 2.5 Coder 7B (LM Studio)' : 'Llama 3.2 3B Instruct (LM Studio)',
      baseUrl: LMSTUDIO_BASE_URL,
      model: getModelForProvider(activeProvider),
      embedModel: LMSTUDIO_EMBED_MODEL,
      timeoutMs: LMSTUDIO_TIMEOUT_MS,
      isLocal: true,
    }
  };
}

export async function testProviderConnection(provider = activeProvider) {
  const normalized = provider === 'lmstudio' ? 'llama' : provider;
  const start = Date.now();

  if (normalized === 'gemini') {
    if (!GEMINI_API_KEY) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        error: 'GEMINI_API_KEY is not configured on server'
      };
    }
    try {
      await callGeminiChat('Respond with {"status":"ok"}', { json: true });
      const latencyMs = Date.now() - start;
      return {
        success: true,
        provider: 'gemini',
        model: GEMINI_MODEL,
        latencyMs,
        message: `Connected successfully to ${GEMINI_MODEL} (${latencyMs}ms)`
      };
    } catch (err) {
      return {
        success: false,
        provider: 'gemini',
        model: GEMINI_MODEL,
        latencyMs: Date.now() - start,
        error: err.message
      };
    }
  }

  // Local LM Studio models (llama or qwen)
  const targetModel = getModelForProvider(normalized);
  const targetName = normalized === 'qwen' ? 'Qwen 2.5 Coder 7B' : 'Llama 3.2 3B Instruct';
  try {
    await callLMStudioChat('Respond with {"status":"ok"}', { json: true, model: targetModel, timeout: 15000 });
    const latencyMs = Date.now() - start;
    return {
      success: true,
      provider: normalized,
      model: targetModel,
      latencyMs,
      message: `Connected successfully to ${targetName} (${targetModel}, ${latencyMs}ms)`
    };
  } catch (err) {
    return {
      success: false,
      provider: normalized,
      model: targetModel,
      latencyMs: Date.now() - start,
      error: `LM Studio connection error (${targetModel}): ${err.message}`
    };
  }
}

export const BLOOM_LEVELS = ['remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'];

const BLOOM_GUIDANCE = {
  remember: 'Recall a specific fact, term, or definition with no reasoning required.',
  understand: 'Explain or paraphrase a concept in the student\'s own terms.',
  apply: 'Use the concept to solve a concrete, previously unseen problem.',
  analyze: 'Break a scenario into parts, compare mechanisms, or trace execution.',
  evaluate: 'Judge, critique, or justify a choice between competing approaches.',
  create: 'Design, compose, or propose a new solution/structure using the concept.'
};

const LMSTUDIO_CHAT_URL = process.env.LMSTUDIO_CHAT_URL || 'http://localhost:1234/api/v1/chat';
const LM_API_TOKEN = process.env.LM_API_TOKEN || '';

// ---------------------------------------------------------------------------
// Low-level provider calls: LM Studio (local) & Gemini (cloud)
// ---------------------------------------------------------------------------

async function callLMStudioChat(prompt, { json = true, temperature = 0.6, system = '', timeout = LMSTUDIO_TIMEOUT_MS, model } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (LM_API_TOKEN) {
    headers['Authorization'] = `Bearer ${LM_API_TOKEN}`;
  }

  const targetModel = model || getModelForProvider(activeProvider);
  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

  // Try OpenAI-compatible endpoint with explicit reasoning_effort: 'none'
  try {
    const res = await axios.post(
      `${LMSTUDIO_BASE_URL}/chat/completions`,
      {
        model: targetModel,
        messages,
        temperature,
        reasoning_effort: 'none',
        max_tokens: 2048
      },
      { headers, timeout }
    );

    const content = res.data?.choices?.[0]?.message?.content;
    if (content) return content;
  } catch (openAiErr) {
    // Fallback: LM Studio native v1 API format
    try {
      const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
      const res = await axios.post(
        LMSTUDIO_CHAT_URL,
        {
          model: targetModel,
          input: fullPrompt,
          temperature,
          context_length: 8000
        },
        { headers, timeout }
      );

      const outputList = res.data?.output;
      if (Array.isArray(outputList) && outputList.length > 0) {
        const msgObj = outputList.find(item => item.type === 'message') || outputList[0];
        if (msgObj?.content) return msgObj.content;
      }
      if (res.data?.choices?.[0]?.message?.content) {
        return res.data.choices[0].message.content;
      }
    } catch (nativeErr) {
      throw new Error(`LM Studio error: ${openAiErr.message}`);
    }
  }

  throw new Error('LM Studio returned an empty response');
}

async function callGeminiChat(prompt, { json = true, temperature = 0.6, system = '' } = {}) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');

  const fullPrompt = system ? `${system}\n\n${prompt}` : prompt;
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    {
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature,
        ...(json ? { responseMimeType: 'application/json' } : {})
      }
    },
    { timeout: GEMINI_TIMEOUT_MS }
  );

  const content = res.data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) throw new Error('Gemini returned an empty response');
  return content;
}

/**
 * Bounded provider chain that respects the activeProvider chosen by the user/teacher.
 * Automatically tries the active provider first, and falls back to the alternate
 * before throwing to the offline curated fallback pool.
 */
async function chatComplete(prompt, opts = {}) {
  if (activeProvider === 'gemini') {
    try {
      return await callGeminiChat(prompt, opts);
    } catch (geminiErr) {
      try {
        return await callLMStudioChat(prompt, opts);
      } catch (lmErr) {
        throw new Error(`All AI providers failed. Gemini: ${geminiErr.message}. LM Studio: ${lmErr.message}`);
      }
    }
  } else {
    try {
      return await callLMStudioChat(prompt, opts);
    } catch (lmErr) {
      try {
        return await callGeminiChat(prompt, opts);
      } catch (geminiErr) {
        throw new Error(`All AI providers failed. LM Studio: ${lmErr.message}. Gemini: ${geminiErr.message}`);
      }
    }
  }
}

async function callLMStudioEmbedding(text) {
  const res = await axios.post(
    `${LMSTUDIO_BASE_URL}/embeddings`,
    { model: LMSTUDIO_EMBED_MODEL, input: text },
    { timeout: LMSTUDIO_TIMEOUT_MS }
  );
  const vec = res.data?.data?.[0]?.embedding;
  if (!Array.isArray(vec) || vec.length === 0) throw new Error('LM Studio returned an empty embedding');
  return vec;
}

async function callGeminiEmbedding(text) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured');
  const res = await axios.post(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_EMBED_MODEL}:embedContent?key=${GEMINI_API_KEY}`,
    { content: { parts: [{ text }] }, outputDimensionality: 768 },
    { timeout: GEMINI_TIMEOUT_MS }
  );
  const vec = res.data?.embedding?.values;
  if (!Array.isArray(vec) || vec.length === 0) throw new Error('Gemini returned an empty embedding');
  return vec;
}

function normalizeToVectorLength(vec, length = 768) {
  if (vec.length === length) return vec;
  if (vec.length > length) return vec.slice(0, length);
  return [...vec, ...new Array(length - vec.length).fill(0)];
}

function deterministicFallbackEmbedding(text) {
  const vec = new Array(768).fill(0);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    vec[i % 768] = (vec[i % 768] + (code / 255)) / 2;
  }
  return vec;
}

// ---------------------------------------------------------------------------
// Question generation (MCQ + descriptive, all 6 Bloom levels)
// ---------------------------------------------------------------------------

function buildMCQPrompt({ concept, subconcept, type, bloom_level, difficulty, constraints }) {
  return `You are an expert computer science educator.
Generate exactly ONE high-quality multiple choice question according to this strict blueprint:
- Concept: ${concept}
- Subconcept: ${subconcept}
- Question Type: ${type}
- Bloom Cognitive Level: ${bloom_level} (${BLOOM_GUIDANCE[bloom_level] || BLOOM_GUIDANCE.apply})
- Difficulty: ${difficulty}
${constraints ? `- Constraints: ${constraints}` : ''}

The question MUST genuinely require the "${bloom_level}" level of thinking described above, not just a surface reword of a different level.

Respond ONLY with valid JSON with this exact structure:
{
  "statement": "string",
  "options": [
    { "id": "opt_1", "text": "option 1 text" },
    { "id": "opt_2", "text": "option 2 text" },
    { "id": "opt_3", "text": "option 3 text" },
    { "id": "opt_4", "text": "option 4 text" }
  ],
  "correct_option_ids": ["opt_2"],
  "explanation": "Brief explanation of why the correct option is correct."
}`;
}

function buildDescriptivePrompt({ concept, subconcept, bloom_level, difficulty, constraints }) {
  return `You are an expert computer science educator.
Generate exactly ONE open-ended, descriptive-answer question (no options) according to this strict blueprint:
- Concept: ${concept}
- Subconcept: ${subconcept}
- Bloom Cognitive Level: ${bloom_level} (${BLOOM_GUIDANCE[bloom_level] || BLOOM_GUIDANCE.apply})
- Difficulty: ${difficulty}
${constraints ? `- Constraints: ${constraints}` : ''}

The question must require a written explanation, comparison, trace, critique, or design proposal
appropriate to the "${bloom_level}" level above — never something answerable with a single word.

Respond ONLY with valid JSON with this exact structure:
{
  "statement": "the descriptive question the student will answer in free text",
  "reference_answer": "a model answer a teacher would accept as fully correct, 2-5 sentences",
  "key_points": ["core point 1 the answer must cover", "core point 2", "core point 3"]
}`;
}

export async function generateQuestion(blueprint) {
  const {
    concept,
    subconcept,
    type = 'mcq_single',
    bloom_level = 'apply',
    difficulty = 'medium',
    constraints = ''
  } = blueprint;

  const normalizedBloom = BLOOM_LEVELS.includes(bloom_level) ? bloom_level : 'apply';
  const isDescriptive = type === 'descriptive';

  const prompt = isDescriptive
    ? buildDescriptivePrompt({ concept, subconcept, bloom_level: normalizedBloom, difficulty, constraints })
    : buildMCQPrompt({ concept, subconcept, type, bloom_level: normalizedBloom, difficulty, constraints });

  try {
    const raw = await chatComplete(prompt, { json: true, temperature: 0.7 });
    const parsed = extractJSON(raw);

    if (isDescriptive) {
      if (parsed && parsed.statement && parsed.reference_answer) {
        return {
          concept,
          subconcept,
          type: 'descriptive',
          bloom_level: normalizedBloom,
          difficulty,
          statement: parsed.statement,
          reference_answer: parsed.reference_answer,
          key_points: Array.isArray(parsed.key_points) ? parsed.key_points : [],
          source: 'ai'
        };
      }
      throw new Error('AI output did not match required descriptive question schema');
    }

    if (parsed && parsed.statement && Array.isArray(parsed.options) && parsed.options.length >= 2 && Array.isArray(parsed.correct_option_ids)) {
      return {
        concept,
        subconcept,
        type,
        bloom_level: normalizedBloom,
        difficulty,
        statement: parsed.statement,
        options: parsed.options,
        correct_option_ids: parsed.correct_option_ids,
        source: 'ai'
      };
    }
    throw new Error('AI output did not match required question schema');
  } catch (err) {
    console.warn(`[ModelAdapter] Generation providers unavailable (${err.message}). Using validated fallback pool.`);

    if (isDescriptive) {
      return buildFallbackDescriptive(concept, subconcept, normalizedBloom, difficulty);
    }

    const match = FALLBACK_QUESTIONS.find(q => q.concept.toLowerCase() === concept.toLowerCase())
      || FALLBACK_QUESTIONS[Math.floor(Math.random() * FALLBACK_QUESTIONS.length)];

    return {
      concept,
      subconcept: subconcept || match.subconcept,
      type: match.type,
      bloom_level: normalizedBloom || match.bloom_level,
      difficulty: difficulty || match.difficulty,
      statement: match.statement,
      options: match.options,
      correct_option_ids: match.correct_option_ids,
      source: 'ai'
    };
  }
}

function cleanPythonCode(code) {
  if (typeof code !== 'string') return '';
  return code
    .replace(/^```(?:python)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^(?:python|py)\s*\n/i, '')
    .trim();
}

/**
 * Generates one auto-graded Code Lab challenge (Python, stdin/stdout).
 *
 * AI output is never trusted for correctness the way an MCQ's schema alone
 * can be validated: instead of asking the model to also invent
 * "expected_output" values (which it can simply get wrong), it is asked for
 * a complete, correct `reference_solution` alongside a deliberately
 * incomplete `initial_code` stub. The reference solution is then actually
 * EXECUTED locally against each test input via the same sandboxed runner
 * Code Lab submissions use, and its real stdout becomes the test case's
 * expected_output — so a generated challenge can never ship with an
 * internally-inconsistent answer key. Throws on any validation failure; the
 * caller (the bounded retry loop in the /generate route) decides what to do.
 */
export async function generateCodingChallenge({ concept, subconcept, difficulty = 'medium', constraints = '' }) {
  const prompt = `You are an expert computer science educator building an auto-graded coding exercise for a browser IDE.

Blueprint:
- Concept: ${concept}
- Subconcept: ${subconcept}
- Difficulty: ${difficulty}
${constraints ? `- Constraints: ${constraints}` : ''}

Design ONE self-contained Python exercise that reads input via sys.stdin and prints output via print().
You must provide BOTH an incomplete starter (with the core logic left as a TODO the student must implement)
AND a complete, correct reference solution using the EXACT SAME input-parsing and output format as the starter
— they must be interchangeable except for the missing logic.

Respond ONLY with valid JSON:
{
  "title": "short challenge title",
  "description": "1-2 sentence task description explaining the input/output format and the goal",
  "initial_code": "python starter code: full stdin parsing already wired up, plus exactly one clearly marked # TODO for the core logic. Must NOT already solve the task.",
  "reference_solution": "a complete, correct python solution solving the task, using the identical stdin/print format as initial_code",
  "expected_behaviour": "one-line summary of what correct output looks like",
  "diagnostic_tags": ["short_snake_case_tag", "..."],
  "test_case_inputs": ["raw stdin value 1", "raw stdin value 2", "raw stdin value 3 (an edge case)"]
}`;

  try {
    const raw = await chatComplete(prompt, { json: true, temperature: 0.3 });
    const parsed = extractJSON(raw);

    if (
      !parsed?.title ||
      !parsed?.description ||
      !parsed?.initial_code ||
      !parsed?.reference_solution ||
      !Array.isArray(parsed?.test_case_inputs) ||
      parsed.test_case_inputs.length < 2
    ) {
      throw new Error('AI output did not match required coding-challenge schema');
    }

    parsed.initial_code = cleanPythonCode(parsed.initial_code);
    parsed.reference_solution = cleanPythonCode(parsed.reference_solution);

    if (!/TODO/i.test(parsed.initial_code)) {
      throw new Error('initial_code has no TODO marker — likely not a genuine incomplete stub');
    }
    if (parsed.initial_code.trim() === parsed.reference_solution.trim()) {
      throw new Error('initial_code is identical to reference_solution — gives away the answer');
    }

    // Ground truth comes from actually running the reference solution, never
    // from whatever output value the model claims.
    const test_cases = [];
    for (let i = 0; i < parsed.test_case_inputs.length; i++) {
      const input = String(parsed.test_case_inputs[i]);
      const result = await runLocally('python', parsed.reference_solution, input);
      if (result.exitCode !== 0 || !result.stdout || !result.stdout.trim()) {
        throw new Error(`Reference solution failed self-check on test case ${i + 1}: ${(result.stderr || 'empty output').slice(0, 200)}`);
      }
      test_cases.push({ input, expected_output: result.stdout.trim(), is_hidden: i >= 1 });
    }

    return {
      concept,
      subconcept,
      difficulty,
      title: parsed.title,
      description: parsed.description,
      initial_code: parsed.initial_code,
      expected_behaviour: parsed.expected_behaviour || 'Produces the correct output for each test case.',
      test_cases,
      diagnostic_tags: Array.isArray(parsed.diagnostic_tags) ? parsed.diagnostic_tags : [],
      source: 'ai'
    };
  } catch (err) {
    console.warn(`[ModelAdapter] Challenge generation failed (${err.message}). Using validated fallback challenge pool.`);
    return buildFallbackChallenge(concept, subconcept, difficulty);
  }
}

export async function generateDiagnostic(gap) {
  const concept = gap.concept;
  const subconcept = gap.subconcept;

  const prompt = `You are a diagnostic learning specialist.
A student has formed an emerging learning gap in ${concept} (${subconcept}).
Identify the likely underlying conceptual misconception and formulate 2 targeted diagnostic probe questions.

Respond ONLY with valid JSON:
{
  "misconception": "string describing the specific conceptual flaw",
  "blueprint": {
    "diagnostic_type": "misconception_probe",
    "focus": "${subconcept}",
    "targeted_questions": [
      {
        "statement": "string",
        "options": [
          { "id": "opt_1", "text": "text" },
          { "id": "opt_2", "text": "text" }
        ],
        "correct_option_ids": ["opt_2"],
        "type": "mcq_single",
        "bloom_level": "analyze"
      }
    ]
  }
}`;

  try {
    const raw = await chatComplete(prompt, { json: true, temperature: 0.5 });
    const parsed = extractJSON(raw);
    if (parsed && parsed.blueprint) {
      return parsed;
    }
    throw new Error('Invalid diagnostic output schema');
  } catch (err) {
    console.warn(`[ModelAdapter] Diagnostic fallback triggered: ${err.message}`);
    return FALLBACK_DIAGNOSTICS[0];
  }
}

export async function generatePlan(gap, diagnosis) {
  const concept = gap.concept;
  const subconcept = gap.subconcept;
  const misconception = diagnosis?.misconception || 'Fundamental conceptual misconception';

  const prompt = `Create an educational intervention learning plan for a student struggling with ${concept} (${subconcept}).
Misconception identified: ${misconception}.
Provide a 3-step structured learning plan and 2 scaffolded practice questions.

Respond ONLY with valid JSON:
{
  "title": "string",
  "description": "string",
  "steps": [
    { "step": 1, "title": "string", "instructions": "string" }
  ],
  "practice_questions": [
    {
      "statement": "string",
      "options": [{ "id": "opt_1", "text": "text" }, { "id": "opt_2", "text": "text" }],
      "correct_option_ids": ["opt_1"],
      "type": "mcq_single",
      "bloom_level": "apply",
      "difficulty": "easy"
    }
  ]
}`;

  try {
    const raw = await chatComplete(prompt, { json: true, temperature: 0.5 });
    const parsed = extractJSON(raw);
    if (parsed && parsed.steps && parsed.practice_questions) {
      return parsed;
    }
    throw new Error('Invalid plan schema');
  } catch (err) {
    console.warn(`[ModelAdapter] Intervention plan fallback triggered: ${err.message}`);
    return FALLBACK_PLANS[0];
  }
}

export async function generateExplanation(challenge, submission, error) {
  const prompt = `A student attempted coding challenge '${challenge.title}'.
Code submitted:
\`\`\`
${submission}
\`\`\`
Test Failure / Error:
${error}

Explain in 2-3 clear, constructive sentences why this failed and the conceptual adjustment needed. Do not provide the full solution code.`;

  try {
    return (await chatComplete(prompt, { json: false, temperature: 0.3 })).trim();
  } catch (err) {
    return 'Your code did not satisfy the expected test condition. Check the edge cases and terminating conditions.';
  }
}

/**
 * Grades a descriptive answer by meaning, not exact wording, against the
 * teacher's reference answer. Returns a structured verdict — never a bare score.
 */
export async function grade_descriptive_answer(questionStatement, referenceAnswer, studentAnswer) {
  const prompt = `You are a computer science teacher grading a student's descriptive explanation.
Question: ${questionStatement}
Teacher's Reference Answer: ${referenceAnswer}
Student's Answer: ${studentAnswer}

Evaluate the student's explanation against the reference answer based on MEANING, not exact wording.
Determine if the explanation is correct, partially correct, or incorrect.
Identify which core conceptual points were covered and which critical points were missed.

CRITICAL: Return ONLY valid JSON with this exact structure:
{
  "verdict": "correct",
  "covered": ["point 1 explained well", "point 2 demonstrated"],
  "missed": ["missing point 1"]
}
The "verdict" property must be exactly "correct", "partial", or "incorrect".
Never return just a number or score.`;

  try {
    const raw = await chatComplete(prompt, { json: true, temperature: 0.2 });
    const parsed = extractJSON(raw);
    if (parsed && ['correct', 'partial', 'incorrect'].includes(parsed.verdict)) {
      return {
        verdict: parsed.verdict,
        covered: Array.isArray(parsed.covered) ? parsed.covered : [],
        missed: Array.isArray(parsed.missed) ? parsed.missed : []
      };
    }
  } catch (err) {
    console.warn(`[ModelAdapter] grade_descriptive_answer providers unavailable: ${err.message}`);
  }

  // Robust deterministic heuristic fallback
  const STOP_WORDS = new Set(['each', 'with', 'without', 'that', 'this', 'from', 'into', 'until', 'when', 'where', 'which', 'their', 'there', 'have', 'been', 'will', 'would', 'should', 'could']);
  const normalize = (txt) => (txt || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w));
  const refWords = Array.from(new Set(normalize(referenceAnswer)));
  const stuWords = new Set(normalize(studentAnswer));

  const matched = refWords.filter(w => stuWords.has(w));
  const missedWords = refWords.filter(w => !stuWords.has(w));
  const matchRatio = refWords.length > 0 ? (matched.length / refWords.length) : 0;

  let verdict = 'incorrect';
  if (matchRatio >= 0.40) {
    verdict = 'correct';
  } else if (matchRatio >= 0.20) {
    verdict = 'partial';
  }

  const covered = matched.length > 0
    ? matched.slice(0, 4).map(w => `Identified key concept related to '${w}'`)
    : [];
  const missed = missedWords.length > 0
    ? missedWords.slice(0, 4).map(w => `Omitted reference point '${w}'`)
    : ['Needs more elaboration on core mechanism'];

  return {
    verdict,
    covered,
    missed
  };
}

export async function generateEmbedding(text) {
  if (activeProvider === 'gemini') {
    try {
      return normalizeToVectorLength(await callGeminiEmbedding(text));
    } catch (geminiErr) {
      try {
        return normalizeToVectorLength(await callLMStudioEmbedding(text));
      } catch (lmErr) {
        console.warn(`[ModelAdapter] Embedding providers unavailable (Gemini: ${geminiErr.message}, LM Studio: ${lmErr.message}). Using deterministic fallback vector.`);
        return deterministicFallbackEmbedding(text);
      }
    }
  } else {
    try {
      return normalizeToVectorLength(await callLMStudioEmbedding(text));
    } catch (lmErr) {
      try {
        return normalizeToVectorLength(await callGeminiEmbedding(text));
      } catch (geminiErr) {
        console.warn(`[ModelAdapter] Embedding providers unavailable (LM Studio: ${lmErr.message}, Gemini: ${geminiErr.message}). Using deterministic fallback vector.`);
        return deterministicFallbackEmbedding(text);
      }
    }
  }
}
