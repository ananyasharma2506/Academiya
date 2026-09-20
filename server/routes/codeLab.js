import express from 'express';
import { query } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { runLocally } from '../lib/localRunner.js';
import { evaluateDebugging } from '../lib/evaluator.js';
import { generateExplanation, generateCodingChallenge } from '../ai/modelAdapter.js';
import { detectGap, getWeaknessProfile } from '../services/evidenceService.js';
import { getRemaining, consume, MAX_PER_SESSION } from '../lib/sessionGenerationLimiter.js';

const router = express.Router();

// Used to personalize self-serve generation when a student has no weakness
// data yet (brand new account) — a plain rotation so the button still does
// something useful rather than erroring out.
const DEFAULT_ROTATION = [
  { concept: 'Recursion', subconcept: 'Base Case Termination' },
  { concept: 'Arrays', subconcept: 'Arrays, Two Pointers & Sliding Window' },
  { concept: 'Linked Lists', subconcept: 'Linked Lists & Pointer Manipulation' },
  { concept: 'Binary Trees', subconcept: 'Binary Trees & Tree Traversals' },
  { concept: 'Sorting & Searching', subconcept: 'Sorting Algorithms & Their Complexities' },
];

// Course categories mirror the Learn window's CS_CURRICULUM subjects
// (app/src/apps/learn/learnCoursesData.ts) by convention — same loose
// id/name matching already used by student_topic_activity, no FK.
const COURSE = {
  DSA: { course_id: 'year1-dsa', course_name: 'Data Structures & Algorithms' },
  DBMS: { course_id: 'year2-dbms', course_name: 'Database Management Systems' },
  NETWORKING: { course_id: 'year3-networking', course_name: 'Computer Networking' },
};

const CHALLENGES = [
  // ── Data Structures & Algorithms ─────────────────────────────────────
  {
    ...COURSE.DSA,
    concept: 'Recursion',
    subconcept: 'Base Case Termination',
    title: 'Recursive Countdown',
    difficulty: 'easy',
    description: 'Write a Python function countdown(n) that prints integers from n down to 1 separated by newlines, terminating safely when n <= 0.',
    initial_code: 'def countdown(n):\n    # TODO: implement recursive countdown\n    if n <= 0:\n        return\n    print(n)\n    countdown(n - 1)\n\nimport sys\nline = sys.stdin.read().strip()\nif line:\n    countdown(int(line))',
    expected_behaviour: 'Prints n down to 1',
    test_cases: [
      { input: '3', expected_output: '3\n2\n1', is_hidden: false },
      { input: '1', expected_output: '1', is_hidden: false },
      { input: '5', expected_output: '5\n4\n3\n2\n1', is_hidden: true },
    ],
    diagnostic_tags: ['recursion', 'call_stack', 'termination'],
  },
  {
    ...COURSE.DSA,
    concept: 'Arrays',
    subconcept: 'Arrays, Two Pointers & Sliding Window',
    title: 'Reverse String In-Place',
    difficulty: 'easy',
    description: 'Reverse an input line string using two pointers and print the result.',
    initial_code: 'import sys\ns = sys.stdin.read().strip()\n\n# TODO: reverse s using two pointers walking from both ends inward\n# (avoid using slicing shortcuts — practice the pointer technique)\nresult = s\nprint(result)',
    expected_behaviour: 'Reverses input',
    test_cases: [
      { input: 'hello', expected_output: 'olleh', is_hidden: false },
      { input: 'Akademiya', expected_output: 'ayimedakA', is_hidden: true },
    ],
    diagnostic_tags: ['two_pointer', 'array_indexing'],
  },
  {
    ...COURSE.DSA,
    concept: 'Arrays',
    subconcept: 'Arrays, Two Pointers & Sliding Window',
    title: 'Two Sum on a Sorted Array',
    difficulty: 'medium',
    description: 'Given a sorted array of integers (line 1) and a target sum (line 2), find the 0-indexed positions of the two numbers that add up to target using the two-pointer technique. Print "i j", or "NOT FOUND" if no pair exists.',
    initial_code: 'def two_sum_sorted(arr, target):\n    # TODO: use two pointers (one from start, one from end) to find\n    # indices of two numbers in the SORTED array that add up to target.\n    # Return "i j" as a string, or "NOT FOUND" if no pair exists.\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\narr = list(map(int, lines[0].split()))\ntarget = int(lines[1])\nprint(two_sum_sorted(arr, target))',
    expected_behaviour: 'Prints the index pair summing to target, or NOT FOUND',
    test_cases: [
      { input: '2 7 11 15\n9', expected_output: '0 1', is_hidden: false },
      { input: '1 2 3 4 6\n6', expected_output: '1 3', is_hidden: false },
      { input: '1 2 3\n100', expected_output: 'NOT FOUND', is_hidden: true },
    ],
    diagnostic_tags: ['two_pointer', 'arrays', 'searching'],
  },
  {
    ...COURSE.DSA,
    concept: 'Arrays',
    subconcept: 'Arrays, Two Pointers & Sliding Window',
    title: 'Maximum Sum Subarray of Size K',
    difficulty: 'medium',
    description: 'Given an array (line 1) and a window size k (line 2), find the maximum sum of any contiguous subarray of length k using the sliding window technique.',
    initial_code: 'def max_sum_subarray(arr, k):\n    # TODO: use a sliding window of size k to find the maximum sum\n    # of any contiguous subarray of length k.\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\narr = list(map(int, lines[0].split()))\nk = int(lines[1])\nprint(max_sum_subarray(arr, k))',
    expected_behaviour: 'Prints the maximum window sum',
    test_cases: [
      { input: '2 1 5 1 3 2\n3', expected_output: '9', is_hidden: false },
      { input: '2 3 4 1 5\n2', expected_output: '7', is_hidden: false },
      { input: '5 -1 3 4 -2 8 -9 10\n3', expected_output: '10', is_hidden: true },
    ],
    diagnostic_tags: ['sliding_window', 'arrays'],
  },
  {
    ...COURSE.DSA,
    concept: 'Linked Lists',
    subconcept: 'Linked Lists & Pointer Manipulation',
    title: 'Reverse a Singly Linked List',
    difficulty: 'easy',
    description: 'Build a singly linked list from the space-separated input values, reverse it in place by re-pointing `next` references, and print the values in reversed order.',
    initial_code: 'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\ndef build_list(values):\n    head = tail = None\n    for v in values:\n        node = Node(v)\n        if head is None:\n            head = tail = node\n        else:\n            tail.next = node\n            tail = node\n    return head\n\ndef reverse_list(head):\n    # TODO: reverse the linked list in place by re-pointing `next`\n    # pointers as you walk the list, and return the new head.\n    pass\n\ndef to_string(head):\n    out = []\n    while head:\n        out.append(str(head.val))\n        head = head.next\n    return " ".join(out)\n\nimport sys\nvalues = list(map(int, sys.stdin.read().strip().split()))\nhead = build_list(values)\nprint(to_string(reverse_list(head)))',
    expected_behaviour: 'Prints the linked list values in reverse order',
    test_cases: [
      { input: '1 2 3 4 5', expected_output: '5 4 3 2 1', is_hidden: false },
      { input: '10 20', expected_output: '20 10', is_hidden: false },
      { input: '7', expected_output: '7', is_hidden: true },
    ],
    diagnostic_tags: ['linked_list', 'pointers'],
  },
  {
    ...COURSE.DSA,
    concept: 'Linked Lists',
    subconcept: 'Linked Lists & Pointer Manipulation',
    title: 'Detect a Cycle in a Linked List',
    difficulty: 'medium',
    description: "Build a linked list from the values (line 1); if the position on line 2 is >= 0, the list's tail connects back to that 0-indexed node, forming a cycle. Use Floyd's slow/fast pointer algorithm to print True if a cycle exists, False otherwise.",
    initial_code: 'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\nvalues = list(map(int, lines[0].split()))\npos = int(lines[1])\n\nnodes = [Node(v) for v in values]\nfor i in range(len(nodes) - 1):\n    nodes[i].next = nodes[i + 1]\nif pos >= 0:\n    nodes[-1].next = nodes[pos]\n\ndef has_cycle(head):\n    # TODO: implement Floyd\'s cycle detection (slow/fast pointers).\n    # Return True if a cycle exists, False otherwise.\n    pass\n\nprint(has_cycle(nodes[0] if nodes else None))',
    expected_behaviour: 'Prints True if the list has a cycle, else False',
    test_cases: [
      { input: '3 2 0 -4\n1', expected_output: 'True', is_hidden: false },
      { input: '1 2\n-1', expected_output: 'False', is_hidden: false },
      { input: '1\n-1', expected_output: 'False', is_hidden: true },
    ],
    diagnostic_tags: ['linked_list', 'floyd_cycle', 'two_pointer'],
  },
  {
    ...COURSE.DSA,
    concept: 'Linked Lists',
    subconcept: 'Linked Lists & Pointer Manipulation',
    title: 'Find the Middle Node',
    difficulty: 'easy',
    description: 'Given a linked list built from the input values, find the middle node using slow/fast pointers. For even-length lists, print the value of the SECOND middle node.',
    initial_code: 'class Node:\n    def __init__(self, val):\n        self.val = val\n        self.next = None\n\ndef build_list(values):\n    head = tail = None\n    for v in values:\n        node = Node(v)\n        if head is None:\n            head = tail = node\n        else:\n            tail.next = node\n            tail = node\n    return head\n\ndef find_middle(head):\n    # TODO: use slow/fast pointers to find the middle node.\n    # For even-length lists, return the SECOND middle node\'s value.\n    pass\n\nimport sys\nvalues = list(map(int, sys.stdin.read().strip().split()))\nhead = build_list(values)\nprint(find_middle(head))',
    expected_behaviour: 'Prints the value of the middle node',
    test_cases: [
      { input: '1 2 3 4 5', expected_output: '3', is_hidden: false },
      { input: '1 2 3 4 5 6', expected_output: '4', is_hidden: false },
      { input: '1 2', expected_output: '2', is_hidden: true },
    ],
    diagnostic_tags: ['linked_list', 'two_pointer'],
  },
  {
    ...COURSE.DSA,
    concept: 'Binary Trees',
    subconcept: 'Binary Trees & Tree Traversals',
    title: 'Binary Tree Inorder Traversal (Iterative)',
    difficulty: 'medium',
    description: 'Insert the space-separated values into a Binary Search Tree in the given order, then print an in-order traversal using an EXPLICIT STACK (no recursion).',
    initial_code: 'class TreeNode:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef insert(root, val):\n    if root is None:\n        return TreeNode(val)\n    if val < root.val:\n        root.left = insert(root.left, val)\n    else:\n        root.right = insert(root.right, val)\n    return root\n\ndef inorder_iterative(root):\n    # TODO: traverse the tree in-order using an explicit stack\n    # (no recursion) and return the values as a list.\n    pass\n\nimport sys\nvalues = list(map(int, sys.stdin.read().strip().split()))\nroot = None\nfor v in values:\n    root = insert(root, v)\nprint(" ".join(map(str, inorder_iterative(root))))',
    expected_behaviour: 'Prints the BST values in sorted (in-order) sequence',
    test_cases: [
      { input: '5 3 8 1 4 7 9', expected_output: '1 3 4 5 7 8 9', is_hidden: false },
      { input: '10 5 15 3 7 12 18', expected_output: '3 5 7 10 12 15 18', is_hidden: false },
      { input: '20 10 30 5 15 25 35', expected_output: '5 10 15 20 25 30 35', is_hidden: true },
    ],
    diagnostic_tags: ['binary_tree', 'stack', 'traversal'],
  },
  {
    ...COURSE.DSA,
    concept: 'Binary Trees',
    subconcept: 'Binary Trees & Tree Traversals',
    title: 'Maximum Depth of a Binary Tree',
    difficulty: 'easy',
    description: 'Insert the space-separated values into a Binary Search Tree in the given order, then print the maximum depth (the number of nodes on the longest root-to-leaf path).',
    initial_code: 'class TreeNode:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef insert(root, val):\n    if root is None:\n        return TreeNode(val)\n    if val < root.val:\n        root.left = insert(root.left, val)\n    else:\n        root.right = insert(root.right, val)\n    return root\n\ndef max_depth(root):\n    # TODO: return the number of nodes on the longest path\n    # from root down to the farthest leaf.\n    pass\n\nimport sys\nvalues = list(map(int, sys.stdin.read().strip().split()))\nroot = None\nfor v in values:\n    root = insert(root, v)\nprint(max_depth(root))',
    expected_behaviour: 'Prints the tree\'s maximum depth',
    test_cases: [
      { input: '5 3 8 1 4 7 9', expected_output: '3', is_hidden: false },
      { input: '10 5 15 3 7 12 18', expected_output: '3', is_hidden: false },
      { input: '1 2 3 4 5', expected_output: '5', is_hidden: true },
    ],
    diagnostic_tags: ['binary_tree', 'recursion', 'depth'],
  },
  {
    ...COURSE.DSA,
    concept: 'Binary Trees',
    subconcept: 'Binary Trees & Tree Traversals',
    title: 'Level Order Traversal (BFS)',
    difficulty: 'medium',
    description: 'Insert the space-separated values into a Binary Search Tree in the given order, then print a breadth-first (level-order) traversal using a queue.',
    initial_code: 'class TreeNode:\n    def __init__(self, val):\n        self.val = val\n        self.left = None\n        self.right = None\n\ndef insert(root, val):\n    if root is None:\n        return TreeNode(val)\n    if val < root.val:\n        root.left = insert(root.left, val)\n    else:\n        root.right = insert(root.right, val)\n    return root\n\ndef level_order(root):\n    # TODO: traverse the tree breadth-first using a queue and\n    # return the values in the order they were visited.\n    pass\n\nimport sys\nvalues = list(map(int, sys.stdin.read().strip().split()))\nroot = None\nfor v in values:\n    root = insert(root, v)\nprint(" ".join(map(str, level_order(root))))',
    expected_behaviour: 'Prints the tree values level by level',
    test_cases: [
      { input: '1', expected_output: '1', is_hidden: false },
      { input: '5 1 3 8 4 9 7', expected_output: '5 1 8 3 7 9 4', is_hidden: false },
      { input: '10 5 15 3 7 12 18', expected_output: '10 5 15 3 7 12 18', is_hidden: true },
    ],
    diagnostic_tags: ['binary_tree', 'bfs', 'queue'],
  },
  {
    ...COURSE.DSA,
    concept: 'Recursion',
    subconcept: 'Recursion & Dynamic Programming Foundations',
    title: 'Factorial with Recursion',
    difficulty: 'easy',
    description: 'Write a recursive function factorial(n) that returns n! (n factorial).',
    initial_code: 'def factorial(n):\n    # TODO: implement factorial recursively (base case: n <= 1).\n    pass\n\nimport sys\nn = int(sys.stdin.read().strip())\nprint(factorial(n))',
    expected_behaviour: 'Prints n factorial',
    test_cases: [
      { input: '5', expected_output: '120', is_hidden: false },
      { input: '0', expected_output: '1', is_hidden: false },
      { input: '10', expected_output: '3628800', is_hidden: true },
    ],
    diagnostic_tags: ['recursion', 'base_case'],
  },
  {
    ...COURSE.DSA,
    concept: 'Dynamic Programming',
    subconcept: 'Recursion & Dynamic Programming Foundations',
    title: 'Fibonacci with Memoization',
    difficulty: 'medium',
    description: 'Write fibonacci(n) using memoization (F(0) = 0, F(1) = 1) so that large n values still run instantly.',
    initial_code: 'def fibonacci(n, memo=None):\n    # TODO: implement Fibonacci with memoization so fib(30)+ runs instantly.\n    # F(0) = 0, F(1) = 1\n    pass\n\nimport sys\nn = int(sys.stdin.read().strip())\nprint(fibonacci(n))',
    expected_behaviour: 'Prints the nth Fibonacci number',
    test_cases: [
      { input: '10', expected_output: '55', is_hidden: false },
      { input: '0', expected_output: '0', is_hidden: false },
      { input: '30', expected_output: '832040', is_hidden: true },
    ],
    diagnostic_tags: ['dynamic_programming', 'memoization', 'recursion'],
  },
  {
    ...COURSE.DSA,
    concept: 'Sorting & Searching',
    subconcept: 'Sorting Algorithms & Their Complexities',
    title: 'Binary Search',
    difficulty: 'easy',
    description: 'Given a sorted array (line 1) and a target (line 2), implement binary search. Print the index of target, or -1 if not found.',
    initial_code: 'def binary_search(arr, target):\n    # TODO: implement classic binary search on the SORTED array.\n    # Return the index of target, or -1 if not found.\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\narr = list(map(int, lines[0].split()))\ntarget = int(lines[1])\nprint(binary_search(arr, target))',
    expected_behaviour: 'Prints the index of target, or -1',
    test_cases: [
      { input: '1 3 5 7 9 11\n7', expected_output: '3', is_hidden: false },
      { input: '2 4 6 8 10\n10', expected_output: '4', is_hidden: false },
      { input: '1 2 3\n5', expected_output: '-1', is_hidden: true },
    ],
    diagnostic_tags: ['binary_search', 'searching'],
  },
  {
    ...COURSE.DSA,
    concept: 'Sorting & Searching',
    subconcept: 'Sorting Algorithms & Their Complexities',
    title: 'Bubble Sort with Swap Counter',
    difficulty: 'medium',
    description: 'Implement bubble sort on the input array. Print the sorted array on the first line, and the total number of swaps performed on the second line.',
    initial_code: 'def bubble_sort(arr):\n    # TODO: implement bubble sort. Return a tuple:\n    # (sorted_list, number_of_swaps_performed)\n    pass\n\nimport sys\narr = list(map(int, sys.stdin.read().strip().split()))\nsorted_arr, swaps = bubble_sort(arr)\nprint(" ".join(map(str, sorted_arr)))\nprint(swaps)',
    expected_behaviour: 'Prints the sorted array then the swap count',
    test_cases: [
      { input: '5 2 4 6 1 3', expected_output: '1 2 3 4 5 6\n9', is_hidden: false },
      { input: '1 2 3', expected_output: '1 2 3\n0', is_hidden: false },
      { input: '9 8 7 6 5', expected_output: '5 6 7 8 9\n10', is_hidden: true },
    ],
    diagnostic_tags: ['sorting', 'bubble_sort'],
  },
  {
    ...COURSE.DSA,
    concept: 'Stacks & Queues',
    subconcept: 'Stacks, Queues & Their Applications',
    title: 'Valid Parentheses Checker',
    difficulty: 'easy',
    description: 'Given a string of brackets, use a stack to check whether every bracket is opened and closed in the correct order. Print True or False.',
    initial_code: 'def is_valid(s):\n    # TODO: use a stack to check that every bracket is closed\n    # in the correct order. Return True or False.\n    pass\n\nimport sys\ns = sys.stdin.read().strip()\nprint(is_valid(s))',
    expected_behaviour: 'Prints True if the brackets are balanced, else False',
    test_cases: [
      { input: '([{}])', expected_output: 'True', is_hidden: false },
      { input: '([)]', expected_output: 'False', is_hidden: false },
      { input: '(((', expected_output: 'False', is_hidden: true },
    ],
    diagnostic_tags: ['stack', 'string_parsing'],
  },
  {
    ...COURSE.DSA,
    concept: 'Stacks & Queues',
    subconcept: 'Stacks, Queues & Their Applications',
    title: 'Implement a Queue Using Two Stacks',
    difficulty: 'medium',
    description: 'Input is N followed by N operations, each "ENQ x" or "DEQ". Implement a FIFO queue using two stacks. For each DEQ, record the dequeued value (or "EMPTY" if the queue is empty). Print all recorded results space-separated.',
    initial_code: 'def process(ops):\n    # ops is a list of tuples: ("ENQ", value) or ("DEQ",)\n    # TODO: implement a queue using two stacks. For each "DEQ" op,\n    # append the dequeued value to `results` (or "EMPTY" if empty).\n    results = []\n    return results\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\nn = int(lines[0])\nops = []\nfor line in lines[1:1 + n]:\n    parts = line.split()\n    if parts[0] == "ENQ":\n        ops.append(("ENQ", parts[1]))\n    else:\n        ops.append(("DEQ",))\nprint(" ".join(map(str, process(ops))))',
    expected_behaviour: 'Prints the sequence of dequeued values',
    test_cases: [
      { input: '4\nENQ 5\nENQ 3\nDEQ\nDEQ', expected_output: '5 3', is_hidden: false },
      { input: '4\nDEQ\nENQ 1\nDEQ\nDEQ', expected_output: 'EMPTY 1 EMPTY', is_hidden: false },
      { input: '8\nENQ 1\nENQ 2\nENQ 3\nDEQ\nENQ 4\nDEQ\nDEQ\nDEQ', expected_output: '1 2 3 4', is_hidden: true },
    ],
    diagnostic_tags: ['stack', 'queue', 'amortized_analysis'],
  },
  {
    ...COURSE.DSA,
    concept: 'Hashing',
    subconcept: 'Hashing Techniques',
    title: 'First Non-Repeating Character',
    difficulty: 'easy',
    description: 'Given a string, use a hash map of character frequencies to find the first character that appears exactly once. Print "NONE" if every character repeats.',
    initial_code: 'def first_non_repeating(s):\n    # TODO: return the first character in s that appears exactly once.\n    # Return "NONE" if every character repeats.\n    pass\n\nimport sys\ns = sys.stdin.read().strip()\nprint(first_non_repeating(s))',
    expected_behaviour: 'Prints the first non-repeating character, or NONE',
    test_cases: [
      { input: 'swiss', expected_output: 'w', is_hidden: false },
      { input: 'aabbcc', expected_output: 'NONE', is_hidden: false },
      { input: 'teeter', expected_output: 'r', is_hidden: true },
    ],
    diagnostic_tags: ['hashing', 'string'],
  },
  {
    ...COURSE.DSA,
    concept: 'Dynamic Programming',
    subconcept: 'Recursion & Dynamic Programming Foundations',
    title: 'Climbing Stairs',
    difficulty: 'medium',
    description: 'You can climb 1 or 2 steps at a time. Given n stairs, print the number of distinct ways to reach the top.',
    initial_code: 'def climb_stairs(n):\n    # TODO: return the number of distinct ways to climb n stairs\n    # taking 1 or 2 steps at a time.\n    pass\n\nimport sys\nn = int(sys.stdin.read().strip())\nprint(climb_stairs(n))',
    expected_behaviour: 'Prints the number of distinct ways to climb n stairs',
    test_cases: [
      { input: '5', expected_output: '8', is_hidden: false },
      { input: '2', expected_output: '2', is_hidden: false },
      { input: '10', expected_output: '89', is_hidden: true },
    ],
    diagnostic_tags: ['dynamic_programming', 'fibonacci_pattern'],
  },

  // ── Database Management Systems ──────────────────────────────────────
  {
    ...COURSE.DBMS,
    concept: 'Relational Algebra',
    subconcept: 'Relational Algebra & SQL Joins',
    title: 'Simulate an Inner JOIN',
    difficulty: 'medium',
    description: 'Table A has N rows of "id name"; table B has M rows of "id dept". Simulate an INNER JOIN on id: for each row in A that has a matching id in B (in A\'s row order), print "id name dept". If nothing matches, print "NO MATCHES".',
    initial_code: 'def inner_join(table_a, table_b):\n    # table_a: list of (id, name) tuples\n    # table_b: dict mapping id -> dept\n    # TODO: return matching rows as "id name dept" strings, in table_a\'s order.\n    # If no rows match, return ["NO MATCHES"].\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\nidx = 0\nn = int(lines[idx]); idx += 1\ntable_a = []\nfor _ in range(n):\n    id_, name = lines[idx].split(); idx += 1\n    table_a.append((id_, name))\nm = int(lines[idx]); idx += 1\ntable_b = {}\nfor _ in range(m):\n    id_, dept = lines[idx].split(); idx += 1\n    table_b[id_] = dept\n\nprint("\\n".join(inner_join(table_a, table_b)))',
    expected_behaviour: 'Prints the joined rows, or NO MATCHES',
    test_cases: [
      { input: '2\n1 Alice\n2 Bob\n2\n1 Engineering\n3 Sales', expected_output: '1 Alice Engineering', is_hidden: false },
      { input: '3\n1 X\n2 Y\n3 Z\n2\n2 Dept2\n3 Dept3', expected_output: '2 Y Dept2\n3 Z Dept3', is_hidden: false },
      { input: '1\n1 Solo\n1\n9 Nope', expected_output: 'NO MATCHES', is_hidden: true },
    ],
    diagnostic_tags: ['sql_joins', 'relational_algebra'],
  },
  {
    ...COURSE.DBMS,
    concept: 'Normalization',
    subconcept: 'Normalization (1NF to BCNF)',
    title: 'Detect a Functional Dependency Violation',
    difficulty: 'medium',
    description: 'Given N rows of "dept location", check whether the functional dependency dept -> location holds. If the SAME dept maps to two DIFFERENT locations, print "VIOLATION: <dept>" for the first one found; otherwise print "NO VIOLATION".',
    initial_code: 'def check_violation(rows):\n    # rows: list of (dept, location) tuples\n    # TODO: a functional dependency dept -> location is violated if\n    # the SAME dept maps to two DIFFERENT locations. Return\n    # "VIOLATION: <dept>" for the first violation found, else "NO VIOLATION".\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\nn = int(lines[0])\nrows = []\nfor line in lines[1:1 + n]:\n    dept, loc = line.split()\n    rows.append((dept, loc))\nprint(check_violation(rows))',
    expected_behaviour: 'Prints the first FD violation found, or NO VIOLATION',
    test_cases: [
      { input: '3\nEng NY\nSales LA\nEng SF', expected_output: 'VIOLATION: Eng', is_hidden: false },
      { input: '3\nEng NY\nSales LA\nEng NY', expected_output: 'NO VIOLATION', is_hidden: false },
      { input: '1\nHR Chicago', expected_output: 'NO VIOLATION', is_hidden: true },
    ],
    diagnostic_tags: ['normalization', 'functional_dependency'],
  },
  {
    ...COURSE.DBMS,
    concept: 'Transactions & Concurrency',
    subconcept: 'Transactions, ACID & B+ Tree Indexing',
    title: 'Replay Committed Transactions Only',
    difficulty: 'hard',
    description: 'Input is N followed by N log lines: "BEGIN tid", "WRITE tid key value", "COMMIT tid", or "ABORT tid". Apply WRITEs to the final state ONLY if their transaction COMMITs — discard writes from ABORTed transactions (atomicity). Print the final state as sorted "key=value" lines, or "EMPTY" if nothing committed.',
    initial_code: 'def replay(ops):\n    # ops: list of tuples like ("BEGIN", tid), ("WRITE", tid, key, val),\n    # ("COMMIT", tid), ("ABORT", tid)\n    # TODO: apply WRITEs from a transaction to the final state ONLY if\n    # that transaction COMMITs. Discard writes from ABORTed transactions.\n    # Return the final state as sorted "key=value" lines (or "EMPTY").\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\nn = int(lines[0])\nops = []\nfor line in lines[1:1 + n]:\n    parts = line.split()\n    ops.append(tuple(parts))\nprint(replay(ops))',
    expected_behaviour: 'Prints the final key=value state from committed transactions only',
    test_cases: [
      { input: '9\nBEGIN T1\nWRITE T1 x 10\nCOMMIT T1\nBEGIN T2\nWRITE T2 x 99\nABORT T2\nBEGIN T3\nWRITE T3 y 5\nCOMMIT T3', expected_output: 'x=10\ny=5', is_hidden: false },
      { input: '4\nBEGIN T1\nWRITE T1 a 1\nWRITE T1 b 2\nCOMMIT T1', expected_output: 'a=1\nb=2', is_hidden: false },
      { input: '3\nBEGIN T1\nWRITE T1 a 1\nABORT T1', expected_output: 'EMPTY', is_hidden: true },
    ],
    diagnostic_tags: ['transactions', 'acid', 'atomicity'],
  },
  {
    ...COURSE.DBMS,
    concept: 'Indexing',
    subconcept: 'Transactions, ACID & B+ Tree Indexing',
    title: 'B+ Tree Leaf Node Split',
    difficulty: 'hard',
    description: "A B+ tree leaf node has overflowed with the given sorted keys (order m). Split at index len(keys)//2: the key at that index is PROMOTEd to the parent, LEFT keeps everything before it, and RIGHT keeps everything from that index onward (inclusive, as B+ tree leaves duplicate the promoted key). Print \"LEFT: ...\\nPROMOTE: ...\\nRIGHT: ...\".",
    initial_code: 'def split_node(keys, m):\n    # keys: sorted list of keys in an overflowed leaf node\n    # TODO: split at index len(keys)//2. The key at that index is\n    # PROMOTEd to the parent; LEFT keeps everything before it,\n    # RIGHT keeps everything from that index onward (inclusive).\n    # Return a string: "LEFT: ...\\nPROMOTE: ...\\nRIGHT: ..."\n    pass\n\nimport sys\nlines = sys.stdin.read().strip().split("\\n")\nkeys = list(map(int, lines[0].split()))\nm = int(lines[1])\nprint(split_node(keys, m))',
    expected_behaviour: 'Prints the LEFT/PROMOTE/RIGHT split of the overflowed node',
    test_cases: [
      { input: '10 20 30 40 50\n4', expected_output: 'LEFT: 10 20\nPROMOTE: 30\nRIGHT: 30 40 50', is_hidden: false },
      { input: '1 2 3\n2', expected_output: 'LEFT: 1\nPROMOTE: 2\nRIGHT: 2 3', is_hidden: false },
      { input: '5 15 25 35 45 55 65\n6', expected_output: 'LEFT: 5 15 25\nPROMOTE: 35\nRIGHT: 35 45 55 65', is_hidden: true },
    ],
    diagnostic_tags: ['b_plus_tree', 'indexing'],
  },

  // ── Computer Networking ───────────────────────────────────────────────
  {
    ...COURSE.NETWORKING,
    concept: 'OSI Model',
    subconcept: 'The OSI & TCP/IP 7-Layer Protocol Stack',
    title: 'OSI Layer Classifier',
    difficulty: 'easy',
    description: 'Given a protocol name (HTTP, FTP, DNS, SMTP, TCP, UDP, IP, or Ethernet), print the OSI layer it primarily operates at: Application, Transport, Network, or Data Link.',
    initial_code: 'def classify(protocol):\n    # TODO: return the OSI layer name for the given protocol:\n    # Application: HTTP, FTP, DNS, SMTP\n    # Transport: TCP, UDP\n    # Network: IP\n    # Data Link: Ethernet\n    pass\n\nimport sys\nprotocol = sys.stdin.read().strip()\nprint(classify(protocol))',
    expected_behaviour: 'Prints the OSI layer for the given protocol',
    test_cases: [
      { input: 'HTTP', expected_output: 'Application', is_hidden: false },
      { input: 'TCP', expected_output: 'Transport', is_hidden: false },
      { input: 'IP', expected_output: 'Network', is_hidden: true },
    ],
    diagnostic_tags: ['osi_model', 'protocols'],
  },
  {
    ...COURSE.NETWORKING,
    concept: 'Transport Layer',
    subconcept: 'Transport Layer: TCP Deep Dive vs UDP',
    title: 'TCP 3-Way Handshake State Machine',
    difficulty: 'medium',
    description: 'Simulate a TCP client state machine starting at CLOSED, processing the space-separated events in order: CLOSED --SEND_SYN--> SYN_SENT --RECV_SYNACK--> ESTABLISHED --RECV_FIN--> CLOSE_WAIT. Ignore any event that is not a valid transition from the current state. Print the final state.',
    initial_code: 'def run_state_machine(events):\n    # TODO: simulate a TCP client starting at "CLOSED":\n    # CLOSED --SEND_SYN--> SYN_SENT --RECV_SYNACK--> ESTABLISHED --RECV_FIN--> CLOSE_WAIT\n    # Ignore any event that doesn\'t match a valid transition from the\n    # current state. Return the final state name.\n    pass\n\nimport sys\nevents = sys.stdin.read().strip().split()\nprint(run_state_machine(events))',
    expected_behaviour: 'Prints the final TCP connection state',
    test_cases: [
      { input: 'SEND_SYN RECV_SYNACK', expected_output: 'ESTABLISHED', is_hidden: false },
      { input: 'SEND_SYN RECV_SYNACK RECV_FIN', expected_output: 'CLOSE_WAIT', is_hidden: false },
      { input: 'RECV_SYNACK SEND_SYN', expected_output: 'SYN_SENT', is_hidden: true },
    ],
    diagnostic_tags: ['tcp', 'state_machine', 'handshake'],
  },
  {
    ...COURSE.NETWORKING,
    concept: 'IP Addressing',
    subconcept: 'IP Addressing, CIDR Subnetting & Routing',
    title: 'CIDR Subnet Mask Calculator',
    difficulty: 'medium',
    description: 'Given a CIDR prefix length (0-32), print the equivalent dotted-decimal subnet mask, e.g. 24 -> "255.255.255.0".',
    initial_code: 'def subnet_mask(prefix_length):\n    # TODO: return the dotted-decimal subnet mask for a given\n    # CIDR prefix length (0-32), e.g. 24 -> "255.255.255.0"\n    pass\n\nimport sys\nprefix = int(sys.stdin.read().strip())\nprint(subnet_mask(prefix))',
    expected_behaviour: 'Prints the dotted-decimal subnet mask',
    test_cases: [
      { input: '24', expected_output: '255.255.255.0', is_hidden: false },
      { input: '20', expected_output: '255.255.240.0', is_hidden: false },
      { input: '30', expected_output: '255.255.255.252', is_hidden: true },
    ],
    diagnostic_tags: ['cidr', 'subnetting', 'ip_addressing'],
  },
  {
    ...COURSE.NETWORKING,
    concept: 'Application Layer',
    subconcept: 'Application Protocols: HTTP/3, DNS & TLS 1.3',
    title: 'Parse an HTTP Request Line',
    difficulty: 'easy',
    description: 'Given a raw HTTP request line like "GET /index.html HTTP/1.1", parse and print the method, path, and version.',
    initial_code: 'def parse_request_line(line):\n    # TODO: split the HTTP request line into method, path, version\n    # and return "METHOD: ...\\nPATH: ...\\nVERSION: ..."\n    pass\n\nimport sys\nline = sys.stdin.read().strip()\nprint(parse_request_line(line))',
    expected_behaviour: 'Prints the parsed METHOD, PATH, and VERSION',
    test_cases: [
      { input: 'GET /index.html HTTP/1.1', expected_output: 'METHOD: GET\nPATH: /index.html\nVERSION: HTTP/1.1', is_hidden: false },
      { input: 'DELETE /users/42 HTTP/1.0', expected_output: 'METHOD: DELETE\nPATH: /users/42\nVERSION: HTTP/1.0', is_hidden: false },
      { input: 'POST /api/login HTTP/2', expected_output: 'METHOD: POST\nPATH: /api/login\nVERSION: HTTP/2', is_hidden: true },
    ],
    diagnostic_tags: ['http', 'parsing', 'application_layer'],
  },
];

// Idempotent per-title seeding: safe to run on every server start without
// duplicating rows or clobbering challenges a teacher may have edited.
async function seedDefaultChallenges() {
  try {
    for (const ch of CHALLENGES) {
      await query(
        `INSERT INTO coding_challenges
         (concept, subconcept, title, description, initial_code, language, expected_behaviour, test_cases, diagnostic_tags, course_id, course_name, difficulty)
         SELECT $1, $2, $3::VARCHAR(255), $4, $5, 'python', $6, $7::jsonb, $8::jsonb, $9, $10, $11
         WHERE NOT EXISTS (SELECT 1 FROM coding_challenges WHERE title = $3::VARCHAR(255))`,
        [
          ch.concept,
          ch.subconcept,
          ch.title,
          ch.description,
          ch.initial_code,
          ch.expected_behaviour,
          JSON.stringify(ch.test_cases),
          JSON.stringify(ch.diagnostic_tags),
          ch.course_id,
          ch.course_name,
          ch.difficulty,
        ]
      );
    }

    // Backfill course_id/course_name/difficulty on any pre-existing rows from
    // before this categorization existed (matched by title, not re-inserted).
    for (const ch of CHALLENGES) {
      await query(
        `UPDATE coding_challenges
         SET course_id = $2, course_name = $3, difficulty = COALESCE(difficulty, $4), subconcept = $5
         WHERE title = $1 AND (course_id IS NULL OR course_name IS NULL)`,
        [ch.title, ch.course_id, ch.course_name, ch.difficulty, ch.subconcept]
      );
    }

    console.log(`🌱 Coding challenges seeded/verified (${CHALLENGES.length} defined across DSA/DBMS/Networking).`);
  } catch (err) {
    console.error('Seed challenges error:', err);
  }
}
seedDefaultChallenges();

// GET /api/code-lab/challenges — shared pool, plus this user's own personalized ones
router.get('/challenges', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM coding_challenges
       WHERE generated_for_student_id IS NULL OR generated_for_student_id = $1
       ORDER BY course_name ASC NULLS LAST, concept ASC, created_at ASC`,
      [req.user.id]
    );
    return res.json({ challenges: result.rows });
  } catch (err) {
    console.error('Get challenges error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/code-lab/generate — bounded (max MAX_PER_SESSION per login session),
// self-serve challenge generation personalized to the student's own weak
// concepts (their "academic graph": learning gaps + low-accuracy evidence).
// Always lands in the separate "Generated" category, never mixed into the
// shared curated pool.
router.post('/generate', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const sessionId = req.user.sessionId;

    const remaining = getRemaining(sessionId, 'code-lab-generate');
    if (remaining <= 0) {
      return res.status(429).json({
        error: `You've used all ${MAX_PER_SESSION} self-generated challenges for this session. Log out and back in to reset.`,
        remaining: 0,
      });
    }

    const requestedCount = Math.min(10, Math.max(1, parseInt(req.body.count, 10) || 3));
    const count = Math.min(requestedCount, remaining);

    const weakness = await getWeaknessProfile(studentId, 5);
    const targets = weakness.length > 0
      ? weakness
      : DEFAULT_ROTATION.map((t) => ({ ...t, weight: 1, reason: 'foundational rotation (no weakness data yet)' }));

    const generated = [];
    const failed = [];
    const MAX_RETRIES = 3;

    for (let i = 0; i < count; i++) {
      const target = targets[i % targets.length];
      let success = false;
      let lastErr = null;

      for (let attempt = 1; attempt <= MAX_RETRIES && !success; attempt++) {
        try {
          const challenge = await generateCodingChallenge({
            concept: target.concept,
            subconcept: target.subconcept,
            difficulty: 'medium',
          });

          const insertRes = await query(
            `INSERT INTO coding_challenges
             (concept, subconcept, title, description, initial_code, language, expected_behaviour, test_cases, diagnostic_tags, course_id, course_name, difficulty, generated_for_student_id)
             VALUES ($1, $2, $3, $4, $5, 'python', $6, $7::jsonb, $8::jsonb, 'generated', 'Generated', $9, $10)
             RETURNING *`,
            [
              challenge.concept,
              challenge.subconcept,
              challenge.title,
              challenge.description,
              challenge.initial_code,
              challenge.expected_behaviour,
              JSON.stringify(challenge.test_cases),
              JSON.stringify(challenge.diagnostic_tags),
              challenge.difficulty,
              studentId,
            ]
          );

          generated.push({ ...insertRes.rows[0], targeted_reason: target.reason || null });
          success = true;
        } catch (err) {
          lastErr = err;
          console.warn(`[CodeLab Generate] attempt ${attempt} failed for ${target.concept}/${target.subconcept}: ${err.message}`);
        }
      }

      if (!success) {
        failed.push({ concept: target.concept, subconcept: target.subconcept, error: lastErr?.message || 'unknown error' });
      }
    }

    consume(sessionId, 'code-lab-generate', generated.length);

    return res.status(201).json({
      generated,
      failed,
      remaining: getRemaining(sessionId, 'code-lab-generate'),
      targeted: targets.slice(0, count).map((t) => ({ concept: t.concept, subconcept: t.subconcept, reason: t.reason })),
    });
  } catch (err) {
    console.error('Code lab generate error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/code-lab/run - Run code with custom input
router.post('/run', requireAuth, async (req, res) => {
  try {
    const { code, language = 'python', stdin = '' } = req.body;
    if (!code) {
      return res.status(400).json({ error: 'code is required' });
    }
    const result = await runLocally(language, code, stdin);
    return res.json({ result });
  } catch (err) {
    console.error('Code run error:', err);
    return res.status(500).json({ error: 'Execution error' });
  }
});

// POST /api/code-lab/submit - Submit code against challenge test cases
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const studentId = req.user.id;
    const { challenge_id, code, language = 'python' } = req.body;

    const cRes = await query('SELECT * FROM coding_challenges WHERE id = $1', [challenge_id]);
    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    const challenge = cRes.rows[0];

    let testCases = [];
    try {
      testCases = typeof challenge.test_cases === 'string'
        ? JSON.parse(challenge.test_cases)
        : challenge.test_cases;
    } catch {
      testCases = [];
    }

    // Deterministic evaluation via evaluator.js
    const evalResult = await evaluateDebugging(code, language, testCases, 10);

    // Also look up or create a shadow question row for this coding challenge to record attempt & evidence
    let qRes = await query('SELECT id FROM questions WHERE statement = $1 LIMIT 1', [challenge.title]);
    let questionId;
    if (qRes.rows.length > 0) {
      questionId = qRes.rows[0].id;
    } else {
      const newQ = await query(
        `INSERT INTO questions (concept, subconcept, type, statement, source)
         VALUES ($1, $2, 'coding', $3, 'teacher')
         RETURNING id`,
        [challenge.concept, challenge.subconcept, challenge.title]
      );
      questionId = newQ.rows[0].id;
    }

    // Record attempt
    const attemptRes = await query(
      `INSERT INTO attempts (student_id, question_id, source, code, is_correct, marks_awarded)
       VALUES ($1, $2, 'practice', $3, $4, $5)
       RETURNING *`,
      [studentId, questionId, code, evalResult.is_correct, evalResult.marks_awarded]
    );

    // Record learning evidence
    await query(
      `INSERT INTO learning_evidence (student_id, concept, subconcept, attempt_id, result)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        studentId,
        challenge.concept,
        challenge.subconcept,
        attemptRes.rows[0].id,
        evalResult.is_correct ? 'correct' : 'incorrect'
      ]
    );

    // Trigger gap detection
    const gap = await detectGap(studentId, challenge.concept, challenge.subconcept);

    // Phase 11: Auto attendance hook on assignment / code completion
    const { checkAttendance } = await import('../services/attendanceService.js');
    await checkAttendance(studentId, new Date(), 'assignment_completion');

    return res.json({
      evaluation: evalResult,
      attempt: attemptRes.rows[0],
      gap_detected: gap
    });
  } catch (err) {
    console.error('Code submit error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/code-lab/explain - Explain test failure using AI
router.post('/explain', requireAuth, async (req, res) => {
  try {
    const { challenge_id, code, error_message } = req.body;
    const cRes = await query('SELECT * FROM coding_challenges WHERE id = $1', [challenge_id]);
    if (cRes.rows.length === 0) {
      return res.status(404).json({ error: 'Challenge not found' });
    }
    const explanation = await generateExplanation(cRes.rows[0], code, error_message);
    return res.json({ explanation });
  } catch (err) {
    console.error('Explain error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
