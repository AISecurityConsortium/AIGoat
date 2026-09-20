/**
 * Cross-mapping hrefs: Risk <-> Lab <-> Surface <-> Challenge.
 */

export function riskPath(qualifiedId) {
  if (!qualifiedId || !String(qualifiedId).includes(':')) {
    return '/owasp-top-10';
  }
  const idx = String(qualifiedId).indexOf(':');
  const fw = String(qualifiedId).slice(0, idx);
  const code = String(qualifiedId).slice(idx + 1);
  return `/owasp-top-10/${encodeURIComponent(fw)}/${encodeURIComponent(code)}`;
}

export function labPath(lab) {
  const id = typeof lab === 'string' ? lab : lab?.id;
  if (!id) return '/attacks';
  const surface = typeof lab === 'string' ? null : lab?.surface;
  if (surface === 'agent.runner' || surface === 'mcp.client' || surface === 'skill.runtime') {
    return `/labs/${encodeURIComponent(id)}`;
  }
  if (surface === 'rag.kb') {
    return `/knowledge-base?lab=${encodeURIComponent(id)}`;
  }
  if (surface === 'chat.cracky' || surface === 'api.raw') {
    return `/attacks?lab=${encodeURIComponent(id)}`;
  }
  return `/labs/${encodeURIComponent(id)}`;
}

export function attacksSurfacePath(surface) {
  return `/attacks?surface=${encodeURIComponent(surface)}`;
}

export function attacksRiskPath(frameworkId, riskCode) {
  const params = new URLSearchParams();
  if (frameworkId) params.set('framework', frameworkId);
  const qs = params.toString();
  const hash = riskCode ? `#${riskCode}` : '';
  return `/attacks${qs ? `?${qs}` : ''}${hash}`;
}

export function challengePath(id) {
  return `/challenges?id=${encodeURIComponent(id)}`;
}
