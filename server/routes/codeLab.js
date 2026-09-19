import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { evaluateDebugging } from '../lib/evaluator.js';
import { generateExplanation } from '../ai/modelAdapter.js';

const router = express.Router();

// GET /api/code-lab/challenges
router.get('/challenges', requireAuth, async (req, res) => {
  try {
    const result = await query('SELECT * FROM coding_challenges ORDER BY created_at DESC');
    res.json({ challenges: result.rows });
  } catch (err) {
    console.error('Fetch challenges error:', err);
    res.status(500).json({ error: 'Failed to fetch coding challenges' });
  }
});

// POST /api/code-lab/run
// Executes student code against challenge test cases via evaluator.js + localRunner.js
// Maps results directly to learning_evidence deterministically.
// AI (generateExplanation) may optionally explain failure, but NEVER decides pass/fail.
router.post('/run', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { challenge_id, code, language = 'python' } = req.body;

    if (!challenge_id || !code) {
      return res.status(400).json({ error: 'challenge_id and code are required' });
    }

    const chRes = await query('SELECT * FROM coding_challenges WHERE id = $1', [challenge_id]);
    if (chRes.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    const challenge = chRes.rows[0];
    const testCases = typeof challenge.test_cases === 'string'
      ? JSON.parse(challenge.test_cases)
      : challenge.test_cases;

    // 1. Run deterministically via evaluator
    const evalResult = await evaluateDebugging(code, language, testCases, 1.0);
    const isPassed = evalResult.visible_cases_passed === evalResult.visible_cases_total &&
                     evalResult.hidden_cases_passed === evalResult.hidden_cases_total;

    // 2. Persist attempt
    const attemptRes = await query(
      `INSERT INTO attempts (student_id, question_id, source, code, is_correct, marks_awarded)
       VALUES ($1, NULL, 'practice', $2, $3, $4)
       RETURNING *`,
      [studentId, code, isPassed, evalResult.marks_awarded]
    );

    // 3. Map directly to learning_evidence
    const evidenceRes = await query(
      `INSERT INTO learning_evidence (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [studentId, challenge.concept, challenge.subconcept, attemptRes.rows[0].id, isPassed ? 'correct' : 'incorrect']
    );

    // 4. If failed, optionally fetch AI explanation (AI explains failure; never decides outcome)
    let explanation = null;
    if (!isPassed) {
      try {
        explanation = await generateExplanation(
          { statement: challenge.description, concept: challenge.concept },
          { selected_option_ids: [code] }
        );
      } catch {
        explanation = 'Review your loop/recursion boundaries and return values against test cases.';
      }
    }

    res.json({
      evaluation: evalResult,
      is_passed: isPassed,
      evidence: evidenceRes.rows[0],
      explanation,
    });
  } catch (err) {
    console.error('Code lab run error:', err);
    res.status(500).json({ error: 'Execution failed: ' + err.message });
  }
});

// POST /api/code-lab/seed
router.post('/seed', requireAuth, async (req, res) => {
  try {
    const {
      concept,
      subconcept,
      title,
      description,
      expected_behaviour,
      starter_code = {},
      test_cases = [],
      diagnostic_tags = [],
    } = req.body;

    const result = await query(
      `INSERT INTO coding_challenges (
        concept, subconcept, title, description, expected_behaviour, starter_code, test_cases, diagnostic_tags
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *`,
      [
        concept,
        subconcept,
        title,
        description,
        expected_behaviour,
        JSON.stringify(starter_code),
        JSON.stringify(test_cases),
        JSON.stringify(diagnostic_tags),
      ]
    );

    res.status(201).json({ challenge: result.rows[0] });
  } catch (err) {
    console.error('Seed challenge error:', err);
    res.status(500).json({ error: 'Failed to seed challenge' });
  }
});

export default router;
