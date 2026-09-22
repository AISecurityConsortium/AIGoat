/**
 * Canonical display order for OWASP tabs and Attack Labs pills.
 * GET /api/frameworks/ is alphabetical, which puts Agentic first.
 */

export const FRAMEWORK_ORDER = [
  'owasp-llm-2026',
  'owasp-mcp-2025',
  'owasp-agentic-2026',
];

export const FRAMEWORK_SHORT_LABELS = {
  'owasp-llm-2026': 'LLM 2026',
  'owasp-mcp-2025': 'MCP 2025',
  'owasp-agentic-2026': 'Agentic 2026',
};

export const DEFAULT_FRAMEWORK = 'owasp-llm-2026';

const idOf = (item) => (typeof item === 'string' ? item : item?.id);

/**
 * Known ids keep FRAMEWORK_ORDER. Unknown ids append alphabetically.
 * @param {Array<object|string>} list
 * @returns {Array<object|string>}
 */
export function sortFrameworks(list) {
  const items = Array.isArray(list) ? list.slice() : [];
  const rank = (id) => {
    const idx = FRAMEWORK_ORDER.indexOf(id);
    return idx === -1 ? FRAMEWORK_ORDER.length : idx;
  };
  items.sort((a, b) => {
    const aid = idOf(a);
    const bid = idOf(b);
    const ra = rank(aid);
    const rb = rank(bid);
    if (ra !== rb) return ra - rb;
    return String(aid || '').localeCompare(String(bid || ''));
  });
  return items;
}

export function shortFrameworkLabel(fw) {
  const id = idOf(fw);
  if (id && FRAMEWORK_SHORT_LABELS[id]) return FRAMEWORK_SHORT_LABELS[id];
  if (fw && typeof fw === 'object' && fw.name) {
    return String(fw.name).replace(/^OWASP /, '').replace(/ for LLM Applications/g, '');
  }
  return id || '';
}

export function frameworkIdFromRisk(qualified) {
  if (!qualified || !String(qualified).includes(':')) return null;
  return String(qualified).slice(0, String(qualified).indexOf(':'));
}

export function labFrameworkId(lab) {
  return frameworkIdFromRisk(lab?.primary_risk || (lab?.risks || [])[0]);
}
