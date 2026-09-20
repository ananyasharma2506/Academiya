/**
 * Pre-generated, pre-validated fallback pool
 * Ensures 100% resilient operation even when the local AI model is offline or busy.
 */

export const FALLBACK_QUESTIONS = [
  {
    concept: 'Recursion',
    subconcept: 'Base Case Termination',
    statement: 'Which of the following functions will cause a stack overflow when invoked with n = 5?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'def f(n): return 1 if n <= 0 else n * f(n-1)' },
      { id: 'opt_2', text: 'def f(n): return 1 if n == 0 else f(n)' },
      { id: 'opt_3', text: 'def f(n): return 0 if n < 1 else f(n - 2)' },
      { id: 'opt_4', text: 'def f(n): return n if n < 2 else f(n-1) + f(n-2)' }
    ],
    correct_option_ids: ['opt_2'],
    bloom_level: 'analyze',
    difficulty: 'medium'
  },
  {
    concept: 'Recursion',
    subconcept: 'Call Stack Frames',
    statement: 'When a recursive call returns a value, what happens to its stack frame in memory?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'It remains permanently in heap storage' },
      { id: 'opt_2', text: 'It is popped off the execution call stack' },
      { id: 'opt_3', text: 'It is duplicated for subsequent calls' },
      { id: 'opt_4', text: 'It becomes the global execution scope' }
    ],
    correct_option_ids: ['opt_2'],
    bloom_level: 'understand',
    difficulty: 'easy'
  },
  {
    concept: 'Recursion',
    subconcept: 'Recursion Tree Depth',
    statement: 'What is the maximum recursion depth for computing Fibonacci(n) with the naive two-branch recursion f(n-1) + f(n-2)?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'O(1)' },
      { id: 'opt_2', text: 'O(n)' },
      { id: 'opt_3', text: 'O(2^n)' },
      { id: 'opt_4', text: 'O(n^2)' }
    ],
    correct_option_ids: ['opt_2'],
    bloom_level: 'analyze',
    difficulty: 'hard'
  },
  {
    concept: 'Recursion',
    subconcept: 'Tail Call Optimization',
    statement: 'Which characteristic qualifies a recursive function for tail-call optimization?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'The recursive call is the very last operation performed before returning' },
      { id: 'opt_2', text: 'The function has two or more base cases' },
      { id: 'opt_3', text: 'The function accepts exactly one integer argument' },
      { id: 'opt_4', text: 'The return value is accumulated in a global variable' }
    ],
    correct_option_ids: ['opt_1'],
    bloom_level: 'understand',
    difficulty: 'medium'
  },
  {
    concept: 'Dynamic Programming',
    subconcept: 'Memoization vs Tabulation',
    statement: 'What distinguishes top-down memoization from bottom-up tabulation?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'Memoization uses recursive calls with a cache, while tabulation iteratively fills a table' },
      { id: 'opt_2', text: 'Tabulation always uses exponential space' },
      { id: 'opt_3', text: 'Memoization avoids solving any subproblems' },
      { id: 'opt_4', text: 'Tabulation cannot solve optimal substructure problems' }
    ],
    correct_option_ids: ['opt_1'],
    bloom_level: 'understand',
    difficulty: 'medium'
  },
  {
    concept: 'Binary Trees',
    subconcept: 'In-order Traversal',
    statement: 'In a Binary Search Tree (BST), which traversal produces nodes in non-decreasing sorted order?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'Pre-order traversal' },
      { id: 'opt_2', text: 'In-order traversal' },
      { id: 'opt_3', text: 'Post-order traversal' },
      { id: 'opt_4', text: 'Level-order traversal' }
    ],
    correct_option_ids: ['opt_2'],
    bloom_level: 'remember',
    difficulty: 'easy'
  },
  {
    concept: 'Arrays',
    subconcept: 'Two Pointer Technique',
    statement: 'Why is the two-pointer technique effective for searching a pair with target sum in a sorted array in O(n) time?',
    type: 'mcq_single',
    options: [
      { id: 'opt_1', text: 'Because sorted order lets us deterministically increase or decrease the sum by moving left or right pointers' },
      { id: 'opt_2', text: 'Because it transforms the array into a hash map' },
      { id: 'opt_3', text: 'Because it splits the array recursively into halves' },
      { id: 'opt_4', text: 'Because it eliminates all negative numbers' }
    ],
    correct_option_ids: ['opt_1'],
    bloom_level: 'analyze',
    difficulty: 'medium'
  }
];

export const FALLBACK_DIAGNOSTICS = [
  {
    misconception: 'Conflating loop counter increment with recursive parameter progression towards base case',
    blueprint: {
      diagnostic_type: 'misconception_probe',
      focus: 'Base Case Termination',
      targeted_questions: [
        {
          statement: 'In def countdown(n): if n == 0: return; countdown(n); where is the bug?',
          options: [
            { id: 'opt_1', text: 'The base case check is incorrect' },
            { id: 'opt_2', text: 'The recursive call does not decrement n towards the base case' },
            { id: 'opt_3', text: 'Recursion cannot be used with integers' },
            { id: 'opt_4', text: 'The function must return a boolean' }
          ],
          correct_option_ids: ['opt_2'],
          type: 'mcq_single',
          bloom_level: 'analyze'
        }
      ]
    }
  }
];

/**
 * Generic, concept-agnostic descriptive question used only when BOTH AI
 * providers (LM Studio + Gemini) are unreachable. Keeps the descriptive path
 * resilient without pretending to have curated content for every concept.
 */
export function buildFallbackDescriptive(concept, subconcept, bloomLevel = 'understand', difficulty = 'medium') {
  const BLOOM_PROMPTS = {
    remember: `State the definition of ${subconcept || concept} in ${concept}.`,
    understand: `In your own words, explain how ${subconcept || concept} works within ${concept}.`,
    apply: `Describe how you would use ${subconcept || concept} to solve a practical problem in ${concept}.`,
    analyze: `Break down ${subconcept || concept} into its key steps or components and explain how they interact.`,
    evaluate: `Judge whether ${subconcept || concept} is the right approach for a given scenario in ${concept}, and justify your reasoning.`,
    create: `Propose a new example or design that demonstrates ${subconcept || concept} in ${concept}.`
  };

  return {
    concept,
    subconcept,
    type: 'descriptive',
    bloom_level: bloomLevel,
    difficulty,
    statement: BLOOM_PROMPTS[bloomLevel] || BLOOM_PROMPTS.understand,
    reference_answer: `A complete answer explains ${subconcept || concept} accurately, covers its core mechanism, and connects it back to ${concept}.`,
    key_points: [`Core mechanism of ${subconcept || concept}`, `Connection to ${concept}`],
    source: 'ai'
  };
}

export const FALLBACK_PLANS = [
  {
    title: 'Recursion Foundation & Base-Case Mastery',
    description: 'Targeted 3-step scaffolded practice to solidify base case identification and call stack tracing.',
    steps: [
      {
        step: 1,
        title: 'Call Stack Visualization',
        instructions: 'Trace the stack frames for countdown(3) on paper to observe push and pop mechanics.'
      },
      {
        step: 2,
        title: 'Base Case Boundary Analysis',
        instructions: 'Practice identifying terminating conditions in single and multi-branch recursion.'
      },
      {
        step: 3,
        title: 'Targeted Practice Questions',
        instructions: 'Complete 3 curated practice questions testing progression guarantees.'
      }
    ],
    practice_questions: [
      {
        concept: 'Recursion',
        subconcept: 'Base Case Termination',
        statement: 'What is the terminating condition in a binary search recursive implementation?',
        options: [
          { id: 'opt_1', text: 'low > high' },
          { id: 'opt_2', text: 'mid == 0' },
          { id: 'opt_3', text: 'low == high' },
          { id: 'opt_4', text: 'array.length == 0' }
        ],
        correct_option_ids: ['opt_1'],
        type: 'mcq_single',
        bloom_level: 'apply',
        difficulty: 'medium'
      }
    ]
  }
];

export const FALLBACK_CHALLENGES = [
  {
    concept: 'Recursion',
    subconcept: 'Base Case Termination',
    title: 'Recursive Factorial Safeguard',
    difficulty: 'easy',
    description: 'Implement a recursive factorial function that correctly returns 1 for n <= 1 and terminates safely for all non-negative integers.',
    initial_code: `import sys

def factorial(n):
    # TODO: Implement base case and recursive step
    pass

line = sys.stdin.read().strip()
if line:
    print(factorial(int(line)))`,
    expected_behaviour: 'Prints the factorial of n',
    test_cases: [
      { input: '0', expected_output: '1', is_hidden: false },
      { input: '4', expected_output: '24', is_hidden: false },
      { input: '6', expected_output: '720', is_hidden: true }
    ],
    diagnostic_tags: ['recursion', 'base_case']
  },
  {
    concept: 'Data Structures',
    subconcept: 'Binary Search',
    title: 'Binary Search Index Finder',
    difficulty: 'medium',
    description: 'Given a space-separated sorted list of integers on line 1 and a target value on line 2, output the 0-based index of target, or -1 if not found.',
    initial_code: `import sys

def binary_search(arr, target):
    # TODO: Implement binary search to return index of target or -1
    pass

lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
if len(lines) >= 2:
    arr = list(map(int, lines[0].split()))
    target = int(lines[1])
    print(binary_search(arr, target))`,
    expected_behaviour: 'Prints index of target or -1',
    test_cases: [
      { input: '2 5 8 12 16\n12', expected_output: '3', is_hidden: false },
      { input: '10 20 30 40\n5', expected_output: '-1', is_hidden: false },
      { input: '1 3 5 7 9\n9', expected_output: '4', is_hidden: true }
    ],
    diagnostic_tags: ['binary_search', 'sorted_array']
  },
  {
    concept: 'Arrays',
    subconcept: 'Arrays, Two Pointers & Sliding Window',
    title: 'Two Sum Sorted Pair',
    difficulty: 'medium',
    description: 'Given a sorted array of integers on line 1 and a target sum on line 2, find the two 0-indexed positions summing to target using two pointers. Print "i j" or "NOT FOUND".',
    initial_code: `import sys

def two_sum_sorted(arr, target):
    # TODO: Use two pointers from both ends to find the pair summing to target
    pass

lines = [l.strip() for l in sys.stdin.read().splitlines() if l.strip()]
if len(lines) >= 2:
    arr = list(map(int, lines[0].split()))
    target = int(lines[1])
    print(two_sum_sorted(arr, target))`,
    expected_behaviour: 'Prints index pair "i j" or NOT FOUND',
    test_cases: [
      { input: '2 7 11 15\n9', expected_output: '0 1', is_hidden: false },
      { input: '1 2 3 4 6\n6', expected_output: '1 3', is_hidden: false },
      { input: '1 2 3\n100', expected_output: 'NOT FOUND', is_hidden: true }
    ],
    diagnostic_tags: ['two_pointer', 'arrays']
  }
];

export function buildFallbackChallenge(concept, subconcept, difficulty = 'medium') {
  const match = FALLBACK_CHALLENGES.find(
    c => c.concept.toLowerCase() === (concept || '').toLowerCase()
  ) || FALLBACK_CHALLENGES[0];

  return {
    concept: concept || match.concept,
    subconcept: subconcept || match.subconcept,
    difficulty: difficulty || match.difficulty,
    title: match.title,
    description: match.description,
    initial_code: match.initial_code,
    expected_behaviour: match.expected_behaviour,
    test_cases: match.test_cases,
    diagnostic_tags: match.diagnostic_tags,
    source: 'fallback'
  };
}

