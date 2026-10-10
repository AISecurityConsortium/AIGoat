/**
 * Guided "Start here" path for shop-home learners.
 *
 * Completion reuses AttacksPage's object at aigoat_owasp_completed_<username>.
 * Lab steps use the lab id as the boolean key (same writes AttacksPage already does).
 * Sibling keys in that same object (AttacksPage does not set these):
 *   - llm01-1-l1  for the L1 retry of Prompt Injection Basics
 *   - challenge-1 for the first CTF flag at /challenges?id=1
 *
 * Dismissal (separate key): aigoat_start_here_dismissed_<username>
 * Restore panel: clear dismiss key and dispatch START_HERE_SHOW_EVENT on window.
 */

export const START_HERE_DISMISSED_PREFIX = 'aigoat_start_here_dismissed_';
export const START_HERE_SHOW_EVENT = 'aigoat_start_here_show';

export const getStartHereDismissedKey = () => {
  const username = localStorage.getItem('username') || 'anonymous';
  return `${START_HERE_DISMISSED_PREFIX}${username}`;
};

export const getCompletionStorageKey = () => {
  const username = localStorage.getItem('username') || 'anonymous';
  return `aigoat_owasp_completed_${username}`;
};

/** Sibling completion keys that are not lab ids. */
export const START_HERE_EXTRA_KEYS = {
  L1_RETRY: 'llm01-1-l1',
  CHALLENGE_1: 'challenge-1',
};

/**
 * @typedef {object} LearningPathStep
 * @property {string} id
 * @property {string} title
 * @property {string} outcome  One-line plain-language outcome
 * @property {string} estimate Time estimate shown to the learner
 * @property {string} path     In-app route (may include query string)
 * @property {string} completionKey Key inside aigoat_owasp_completed_<user>
 * @property {string} [hint]   Extra guidance (e.g. switch defense level)
 */

/** @type {LearningPathStep[]} */
export const LEARNING_PATH = [
  {
    id: 'llm01-1-l0',
    title: 'Prompt Injection Basics',
    outcome: 'Make Cracky ignore its rules and reveal something it should not.',
    estimate: '~10 min',
    path: '/attacks?framework=owasp-llm-2026&lab=llm01-1',
    completionKey: 'llm01-1',
    hint: 'Keep the header chip on L0 Vulnerable.',
  },
  {
    id: 'llm01-1-l1',
    title: 'Retry at L1',
    outcome: 'See how prompt hardening changes the same attack.',
    estimate: '~5 min',
    path: '/attacks?framework=owasp-llm-2026&lab=llm01-1',
    completionKey: START_HERE_EXTRA_KEYS.L1_RETRY,
    hint: 'Switch the header chip to L1 Hardened, then retry the same lab.',
  },
  {
    id: 'llm08-1',
    title: 'System Prompt Extraction',
    outcome: 'Pull hidden instructions out of the model context.',
    estimate: '~10 min',
    path: '/attacks?framework=owasp-llm-2026&lab=llm08-1',
    completionKey: 'llm08-1',
  },
  {
    id: 'llm09-1',
    title: 'Vector and Embedding Weaknesses',
    outcome: 'Poison a knowledge-base document and watch retrieval trust it.',
    estimate: '~15 min',
    path: '/knowledge-base?lab=llm09-1',
    completionKey: 'llm09-1',
  },
  {
    id: 'asi06-1',
    title: 'Memory Poisoning',
    outcome: 'Plant a standing note that steers the shop agent later.',
    estimate: '~15 min',
    path: '/labs/asi06-1',
    completionKey: 'asi06-1',
  },
  {
    id: 'mcp03-1',
    title: 'Tool Description Poisoning',
    outcome: 'Treat an MCP tool description as attacker-controlled text.',
    estimate: '~15 min',
    path: '/labs/mcp03-1',
    completionKey: 'mcp03-1',
  },
  {
    id: 'challenge-1',
    title: 'First flag',
    outcome: 'Solve challenge 1 and submit your first AIGOAT flag.',
    estimate: '~15 min',
    path: '/challenges?id=1',
    completionKey: START_HERE_EXTRA_KEYS.CHALLENGE_1,
  },
];

export default LEARNING_PATH;
