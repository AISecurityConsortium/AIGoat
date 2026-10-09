/**
 * Evidence vocabulary shared by every threat-modeling data module and component.
 *
 * Rule for this page: a claim is never presented as a "vulnerability" unless
 * the repo proves it AND it is not an intentional training weakness.
 *   verified          - supported by code or configuration, with a repo path.
 *   hypothesis        - a threat derived from the architecture. Not confirmed.
 *   needs-validation  - a potential weakness that must be tested before anyone
 *                       calls it a finding.
 * Two flags can sit on top of a verified claim:
 *   byDesign          - an intentional training weakness (the lab is the point).
 *   absence           - "no control found in this repo" (a verified absence of
 *                       code, not a confirmed exploitable flaw).
 */

export const EVIDENCE_CLASSES = ['verified', 'hypothesis', 'needs-validation'];

export const EVIDENCE_META = {
  verified: {
    label: 'Verified in repo',
    short: 'Verified',
    description: 'Supported by code or configuration. A repo path is cited.',
  },
  hypothesis: {
    label: 'Threat hypothesis',
    short: 'Hypothesis',
    description: 'Derived from the architecture. Not confirmed by a test.',
  },
  'needs-validation': {
    label: 'Needs validation',
    short: 'Validate',
    description: 'A potential weakness that must be tested before it is called a finding.',
  },
};

export const FLAG_META = {
  byDesign: {
    label: 'By design (training lab)',
    description: 'An intentional teaching weakness. It is the product, not a bug.',
  },
  absence: {
    label: 'No control found in repo',
    description: 'A verified absence of code. It is not proof of an exploitable flaw.',
  },
  analytical: {
    label: 'Analytical recommendation',
    description: 'AIGoat teaching commentary. Not an official framework mapping.',
  },
};

/** Build a claim object. */
export const claim = (text, evidence = 'verified', extra = {}) => ({
  text,
  evidence,
  ...extra,
});

/** Shorthands used inside the data files. */
export const verified = (text, refs = [], extra = {}) => claim(text, 'verified', { refs, ...extra });
export const hypothesis = (text, extra = {}) => claim(text, 'hypothesis', extra);
export const validate = (text, extra = {}) => claim(text, 'needs-validation', extra);
