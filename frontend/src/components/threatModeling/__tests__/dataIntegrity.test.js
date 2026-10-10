import {
  DEFENSE_OVERLAY, EDGES, NODES, NODE_BY_ID, NODE_STATUS, NOT_PRESENT, TRUST_BOUNDARIES, ZONE_BY_ID,
} from '../../../data/threatModeling/architecture';
import {
  AIX_CONTROLS, FRAMEWORKS, FRAMEWORK_BY_ID, FRAMEWORK_CATEGORIES, LENS_ROLES, MATRIX, MATRIX_COLUMNS,
  SAIF_AGENT_COMPONENTS, SAIF_COMPONENT_AREAS, SAIF_ELEMENTS, SAIF_RISKS,
} from '../../../data/threatModeling/frameworks';
import { SCENARIOS, SCENARIO_LENS_ORDER } from '../../../data/threatModeling/scenarios';
import { SELECTION_GUIDE } from '../../../data/threatModeling/selectionGuide';
import { EVIDENCE_CLASSES } from '../../../data/threatModeling/evidence';
import { LIFECYCLE, PRACTICES, REFERENCE_GROUPS, WHY_IT_MATTERS } from '../../../data/threatModeling/content';

const EM_DASH = String.fromCharCode(0x2014);

/** Every claim in every scenario, with a label for failure messages. */
const scenarioClaims = () => SCENARIOS.flatMap((s) => {
  const out = s.attackPath.map((c) => ({ where: `${s.id} path`, claim: c }));
  ['discovery', 'context', 'risk'].forEach((l) => s.lenses[l].finds.forEach((c) => out.push({ where: `${s.id} ${l}`, claim: c })));
  return out;
});

const nodeClaims = () => NODES.flatMap((n) => [
  ...n.facts.map((c) => ({ where: `${n.id} fact`, claim: c, expected: 'verified' })),
  ...n.hypotheses.map((c) => ({ where: `${n.id} hypothesis`, claim: c, expected: 'hypothesis' })),
  ...n.toValidate.map((c) => ({ where: `${n.id} validate`, claim: c, expected: 'needs-validation' })),
]);

describe('architecture data', () => {
  test('every edge connects existing nodes or a zone', () => {
    EDGES.forEach((e) => {
      [e.from, e.to].forEach((id) => {
        const ok = id.startsWith('zone:') ? Boolean(ZONE_BY_ID[id.slice(5)]) : Boolean(NODE_BY_ID[id]);
        expect({ edge: e.id, id, ok }).toEqual({ edge: e.id, id, ok: true });
      });
      expect(['forward', 'both']).toContain(e.direction);
      if (e.boundary) expect(TRUST_BOUNDARIES.map((b) => b.id)).toContain(e.boundary);
      expect(e.evidence.length).toBeGreaterThan(0);
    });
  });

  test('every node has status, zone, description and evidence', () => {
    expect(new Set(NODES.map((n) => n.id)).size).toBe(NODES.length);
    NODES.forEach((n) => {
      expect(NODE_STATUS[n.status]).toBeDefined();
      expect(ZONE_BY_ID[n.zone]).toBeDefined();
      expect(n.summary.length).toBeGreaterThan(10);
      expect(n.evidence.length).toBeGreaterThan(0);
      expect(n.facts.length + n.hypotheses.length + n.toValidate.length).toBeGreaterThan(0);
    });
  });

  test('claims on nodes carry the matching evidence class, and verified claims cite a path', () => {
    nodeClaims().forEach(({ where, claim, expected }) => {
      expect({ where, evidence: claim.evidence }).toEqual({ where, evidence: expected });
      if (expected === 'verified') expect({ where, refs: (claim.refs || []).length > 0 }).toEqual({ where, refs: true });
    });
  });

  test('items marked not present are never drawn as nodes', () => {
    const labels = NODES.map((n) => n.label.toLowerCase());
    NOT_PRESENT.forEach((item) => {
      expect(NODE_BY_ID[item.id]).toBeUndefined();
      expect(labels).not.toContain(item.label.toLowerCase());
    });
  });

  test('optional components are marked optional, not confirmed', () => {
    expect(NODE_BY_ID.mcphost.status).toBe('optional');
    expect(NODE_BY_ID.nemo.status).toBe('optional');
    ['hfhub', 'registry', 'pkgs'].forEach((id) => expect(NODE_BY_ID[id].status).toBe('external'));
  });

  test('defense overlay exists', () => {
    expect(DEFENSE_OVERLAY).toBeDefined();
  });
});

describe('framework data', () => {
  test('covers the ten required resources with categories, links and matrix rows', () => {
    const ids = ['stride', 'pasta', 'linddun', 'attack-trees', 'atlas', 'owasp-llm', 'owasp-agentic', 'nist-ai-rmf', 'saif', 'owasp-ai-exchange'];
    expect(FRAMEWORKS.map((f) => f.id).sort()).toEqual([...ids].sort());
    FRAMEWORKS.forEach((f) => {
      expect(FRAMEWORK_CATEGORIES[f.category]).toBeDefined();
      expect(f.url).toMatch(/^https:\/\//);
      MATRIX_COLUMNS.forEach((c) => expect(MATRIX[f.id][c.key]).toBeTruthy());
    });
  });

  test('SAIF has the six elements, four component areas and agent components', () => {
    expect(SAIF_ELEMENTS).toHaveLength(6);
    expect(SAIF_COMPONENT_AREAS.map((a) => a.area)).toEqual(['Data', 'Infrastructure', 'Model', 'Application']);
    expect(SAIF_AGENT_COMPONENTS.length).toBeGreaterThanOrEqual(4);
  });

  test('the AI Exchange is not described as a component-level methodology', () => {
    const text = JSON.stringify(FRAMEWORK_BY_ID['owasp-ai-exchange']);
    expect(text).toMatch(/not a diagramming method/i);
    expect(FRAMEWORK_BY_ID['owasp-ai-exchange'].category).not.toBe('methodology');
    expect(FRAMEWORK_BY_ID.saif.category).not.toBe('methodology');
  });

  test('selection guide only references known frameworks', () => {
    SELECTION_GUIDE.forEach((e) => {
      expect(FRAMEWORK_BY_ID[e.primary]).toBeDefined();
      e.complementary.forEach((id) => expect(FRAMEWORK_BY_ID[id]).toBeDefined());
    });
  });

  test('five distinct lens roles exist', () => {
    expect(LENS_ROLES.map((r) => r.id)).toEqual(SCENARIO_LENS_ORDER);
  });
});

describe('scenarios', () => {
  test('there are exactly six, with supply chain and consumption separate', () => {
    expect(SCENARIOS).toHaveLength(6);
    expect(SCENARIOS.map((s) => s.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const ids = SCENARIOS.map((s) => s.id);
    expect(ids).toContain('supply-chain');
    expect(ids).toContain('unbounded-consumption');
  });

  test.each(SCENARIOS.map((s) => [s.id, s]))('%s has every mandatory item', (_id, s) => {
    expect(s.title).toBeTruthy();
    expect(s.context.length).toBeGreaterThan(40);
    expect(s.components.length).toBeGreaterThan(0);
    s.components.forEach((id) => expect(NODE_BY_ID[id]).toBeDefined());
    expect(s.assets.length).toBeGreaterThan(0);
    expect(s.attacker.assumptions.length).toBeGreaterThan(0);
    expect(s.attacker.prerequisites.length).toBeGreaterThan(0);
    s.boundaries.forEach((id) => expect(TRUST_BOUNDARIES.map((b) => b.id)).toContain(id));
    expect(s.boundaries.length).toBeGreaterThan(0);
    expect(s.attackPath.length).toBeGreaterThanOrEqual(4);
    s.attackPath.forEach((step) => (step.nodes || []).forEach((id) => expect(NODE_BY_ID[id]).toBeDefined()));
    expect(s.overlap).toBeTruthy();
    expect(s.risk.likelihood).toBeTruthy();
    expect(s.risk.impact).toBeTruthy();
    expect(s.risk.rationale).toBeTruthy();
    expect(s.risk.assumptions.length).toBeGreaterThan(0);
    expect(s.mitigations.length).toBeGreaterThan(0);
    expect(s.residual.length).toBeGreaterThan(0);
    expect(s.labs.length).toBeGreaterThan(0);
  });

  test.each(SCENARIOS.map((s) => [s.id, s]))('%s has all five lenses with a distinct contribution', (_id, s) => {
    SCENARIO_LENS_ORDER.forEach((l) => {
      expect(s.lenses[l]).toBeDefined();
      expect((s.lenses[l].unique || '').length).toBeGreaterThan(20);
    });
    const uniques = SCENARIO_LENS_ORDER.map((l) => s.lenses[l].unique);
    expect(new Set(uniques).size).toBe(uniques.length);
  });

  test.each(SCENARIOS.map((s) => [s.id, s]))('%s SAIF lens uses only official areas, risks and controls', (_id, s) => {
    const { saif } = s.lenses;
    const areaNames = SAIF_COMPONENT_AREAS.map((a) => a.area);
    saif.areas.forEach((a) => expect(areaNames).toContain(a));
    expect(saif.risks.length).toBeGreaterThan(0);
    saif.risks.forEach((r) => {
      expect(SAIF_RISKS[r.risk]).toBeDefined();
      expect(r.controls).toEqual(SAIF_RISKS[r.risk].controls);
      expect(r.controls.length).toBeGreaterThan(0);
    });
    expect(saif.analytical.length).toBeGreaterThan(0);
  });

  test.each(SCENARIOS.map((s) => [s.id, s]))('%s AI Exchange lens uses controls found on checked pages', (_id, s) => {
    const { aix } = s.lenses;
    expect(aix.threats.length).toBeGreaterThan(0);
    aix.controls.forEach((c) => expect(AIX_CONTROLS).toContain(c));
    aix.sections.forEach((sec) => expect(sec.url).toMatch(/^https:\/\/owaspai\.org\//));
    expect(aix.limitation).toBeTruthy();
  });

  test('every claim has a known evidence class', () => {
    scenarioClaims().forEach(({ where, claim }) => {
      expect({ where, ok: EVIDENCE_CLASSES.includes(claim.evidence) }).toEqual({ where, ok: true });
    });
  });

  test('verified claims cite a repo path unless they describe an external framework', () => {
    SCENARIOS.forEach((s) => {
      const withRefs = s.attackPath.filter((c) => c.evidence === 'verified' && (c.refs || []).length > 0);
      expect(withRefs.length).toBeGreaterThan(0);
      s.attackPath.filter((c) => c.evidence === 'verified').forEach((c) => expect((c.refs || []).length).toBeGreaterThan(0));
    });
  });

  test('nothing unverified is called a confirmed vulnerability', () => {
    const banned = /confirmed (vulnerab|exploit)|is vulnerable|proven (vulnerab|exploit)|actively exploited/i;
    [...scenarioClaims(), ...nodeClaims()]
      .filter(({ claim }) => claim.evidence !== 'verified')
      .forEach(({ where, claim }) => expect({ where, hit: banned.test(claim.text) }).toEqual({ where, hit: false }));
  });

  test('mitigations separate implemented controls from candidates', () => {
    SCENARIOS.forEach((s) => {
      s.mitigations.forEach((m) => {
        expect(['implemented', 'candidate']).toContain(m.state);
        expect(m.limit).toBeTruthy();
        if (m.state === 'implemented') expect((m.refs || []).length).toBeGreaterThan(0);
      });
      expect(s.mitigations.some((m) => m.state === 'candidate')).toBe(true);
    });
  });
});

describe('content', () => {
  test('reference URLs are https and unique', () => {
    const urls = REFERENCE_GROUPS.flatMap((g) => g.items.map((i) => i.url));
    urls.forEach((u) => expect(u).toMatch(/^https:\/\//));
    expect(new Set(urls).size).toBe(urls.length);
  });

  test('has the required prose sections and no em dashes', () => {
    expect(WHY_IT_MATTERS.length).toBeGreaterThanOrEqual(8);
    expect(PRACTICES.map((p) => p.id)).toEqual(expect.arrayContaining(['red-teaming', 'scanning', 'pentest', 'risk-mgmt']));
    expect(LIFECYCLE.length).toBeGreaterThanOrEqual(5);
    const everything = JSON.stringify({ NODES, EDGES, FRAMEWORKS, MATRIX, SCENARIOS, SELECTION_GUIDE, WHY_IT_MATTERS, PRACTICES, LIFECYCLE, REFERENCE_GROUPS });
    expect(everything.includes(EM_DASH)).toBe(false);
  });
});
