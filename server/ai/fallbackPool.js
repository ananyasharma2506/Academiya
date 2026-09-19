/**
 * Pre-written, already-validated demo fallback questions, diagnostics,
 * plans, and explanations organized by concept.
 *
 * Used automatically by modelAdapter when the local LLM is unavailable or fails,
 * routing through the exact same validate -> persist -> stream path as live generations.
 */

export const FALLBACK_QUESTIONS = {
  Recursion: [
    {
      concept: 'Recursion',
      subconcept: 'Base Case Handling',
      type: 'mcq_single',
      statement: 'Which of the following describes what happens when a recursive function fails to reach its base case?',
      options: [
        { id: 'opt_1', text: 'The program halts immediately without error' },
        { id: 'opt_2', text: 'Call stack grows unbounded until a stack overflow occurs' },
        { id: 'opt_3', text: 'The function automatically restarts with default parameters' },
        { id: 'opt_4', text: 'Heap memory leaks without affecting execution stack' }
      ],
      correct_option_ids: ['opt_2'],
      bloom_level: 'understand',
      difficulty: 'medium'
    },
    {
      concept: 'Recursion',
      subconcept: 'Call Stack Unwinding',
      type: 'mcq_single',
      statement: 'In recursion, when does execution control start unwinding back to caller frames?',
      options: [
        { id: 'opt_1', text: 'When the base condition evaluates to true' },
        { id: 'opt_2', text: 'When heap garbage collection triggers' },
        { id: 'opt_3', text: 'Immediately after the first recursive call returns void' },
        { id: 'opt_4', text: 'When the operating system preempts the thread' }
      ],
      correct_option_ids: ['opt_1'],
      bloom_level: 'analyze',
      difficulty: 'medium'
    },
    {
      concept: 'Recursion',
      subconcept: 'Tail Call Optimization',
      type: 'mcq_single',
      statement: 'What property makes a recursive function eligible for Tail Call Optimization (TCO)?',
      options: [
        { id: 'opt_1', text: 'The recursive call is enclosed inside a while loop' },
        { id: 'opt_2', text: 'The function has at least three distinct base cases' },
        { id: 'opt_3', text: 'The recursive call is the very last operation executed in the function' },
        { id: 'opt_4', text: 'The recursion is replaced with dynamic method dispatch' }
      ],
      correct_option_ids: ['opt_3'],
      bloom_level: 'understand',
      difficulty: 'hard'
    }
  ],
  default: [
    {
      concept: 'General Computer Science',
      subconcept: 'Algorithmic Complexity',
      type: 'mcq_single',
      statement: 'What is the time complexity of searching an element in a balanced binary search tree of N elements?',
      options: [
        { id: 'opt_1', text: 'O(1)' },
        { id: 'opt_2', text: 'O(log N)' },
        { id: 'opt_3', text: 'O(N)' },
        { id: 'opt_4', text: 'O(N log N)' }
      ],
      correct_option_ids: ['opt_2'],
      bloom_level: 'apply',
      difficulty: 'medium'
    },
    {
      concept: 'General Computer Science',
      subconcept: 'Data Structures',
      type: 'mcq_single',
      statement: 'Which data structure follows the First-In-First-Out (FIFO) principle?',
      options: [
        { id: 'opt_1', text: 'Stack' },
        { id: 'opt_2', text: 'Queue' },
        { id: 'opt_3', text: 'Priority Queue' },
        { id: 'opt_4', text: 'Binary Tree' }
      ],
      correct_option_ids: ['opt_2'],
      bloom_level: 'remember',
      difficulty: 'easy'
    }
  ]
};

export const FALLBACK_DIAGNOSTICS = {
  Recursion: {
    focus_concept: 'Recursion',
    isolated_misconception: 'Confusing base case termination with recursive loop step',
    recommended_probes: [
      'Trace call stack frames for input n = 3',
      'Identify missing return statement in base condition'
    ],
    probe_questions: [
      {
        concept: 'Recursion',
        subconcept: 'Base Case Handling',
        type: 'mcq_single',
        statement: 'Given `def f(n): if n == 0: return; f(n-1)`, what is returned when f(2) finishes?',
        options: [
          { id: 'opt_1', text: 'None / undefined' },
          { id: 'opt_2', text: '0' },
          { id: 'opt_3', text: '2' },
          { id: 'opt_4', text: 'Infinite recursion' }
        ],
        correct_option_ids: ['opt_1'],
        bloom_level: 'analyze',
        difficulty: 'medium'
      }
    ]
  }
};

export const FALLBACK_PLANS = {
  Recursion: {
    target_concept: 'Recursion',
    summary: 'Targeted Remediation on Call Stack Unwinding and Base Cases',
    steps: [
      { step: 1, title: 'Visual Call Stack Tracing', description: 'Step through 3 single-branch recursive traces' },
      { step: 2, title: 'Base Condition Verification', description: 'Complete 3 targeted questions on edge conditions' }
    ],
    practice_count: 3
  }
};

export const FALLBACK_EXPLANATIONS = {
  Recursion: 'In recursion, each call creates a new stack frame. Without a base condition, new frames keep accumulating until maximum call stack size is exceeded, raising a StackOverflow error.'
};
