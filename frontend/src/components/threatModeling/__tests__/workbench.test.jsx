import React from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ThreatModelingPage, { SECTIONS } from '../../ThreatModelingPage';
import { NODE_BY_ID } from '../../../data/threatModeling/architecture';
import { FRAMEWORKS } from '../../../data/threatModeling/frameworks';
import { SCENARIOS } from '../../../data/threatModeling/scenarios';

/** Minimal matchMedia: evaluates "(max-width:Npx)" against a chosen viewport width. */
const setViewport = (width) => {
  window.matchMedia = (query) => {
    const m = /max-width:\s*(\d+)px/.exec(query);
    return {
      matches: m ? width <= Number(m[1]) : false,
      media: query,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
    };
  };
};

const renderPage = (width = 1440) => {
  setViewport(width);
  return render(<MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}><ThreatModelingPage /></MemoryRouter>);
};

const zoomOf = () => Number(screen.getByTestId('architecture-diagram').getAttribute('data-zoom'));

describe('page structure', () => {
  test('sections appear in the required order', () => {
    renderPage();
    const headings = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
    expect(headings).toEqual([
      'Start here',
      'AIGoat architecture',
      'Frameworks and resources',
      'Which framework should I use?',
      'Scenario deep dives',
      'Why AI threat modeling matters',
      'References',
    ]);
  });

  test('section navigation links to every section', () => {
    renderPage();
    SECTIONS.forEach((s) => {
      const link = screen.getByTestId(`nav-${s.id}`);
      expect(link).toHaveAttribute('href', `#${s.id}`);
      expect(document.getElementById(s.id)).not.toBeNull();
    });
  });

  test('the legend separates verified, hypothesis, needs-validation and by-design', () => {
    renderPage();
    const legend = screen.getByTestId('evidence-legend');
    ['Verified in repo', 'Threat hypothesis', 'Needs validation', 'By design (training lab)', 'No control found in repo', 'Analytical recommendation']
      .forEach((text) => expect(within(legend).getByText(text)).toBeInTheDocument());
  });
});

describe('architecture interactions', () => {
  test('clicking a node opens its detail with separate fact, hypothesis and validation sections', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('node-chat'));
    const panel = screen.getByTestId('detail-panel');
    expect(within(panel).getByRole('heading', { name: NODE_BY_ID.chat.label })).toBeInTheDocument();
    expect(within(panel).getAllByTestId('evidence-verified').length).toBeGreaterThan(0);
    expect(within(panel).getAllByTestId('claim-row').length).toBeGreaterThan(1);
  });

  test('Enter and Space select a node, Escape in the panel closes it', () => {
    renderPage();
    fireEvent.keyDown(screen.getByTestId('node-rag'), { key: 'Enter' });
    expect(within(screen.getByTestId('detail-panel')).getByRole('heading', { name: NODE_BY_ID.rag.label })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('node-ollama'), { key: ' ' });
    expect(within(screen.getByTestId('detail-panel')).getByRole('heading', { name: NODE_BY_ID.ollama.label })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByTestId('detail-panel'), { key: 'Escape' });
    expect(screen.getByTestId('detail-panel-empty')).toBeInTheDocument();
  });

  test('zoom in, zoom out, fit and reset change the view reliably', () => {
    renderPage();
    expect(zoomOf()).toBe(100);
    fireEvent.click(screen.getByTestId('diagram-zoom-in'));
    expect(zoomOf()).toBeGreaterThan(100);
    fireEvent.click(screen.getByTestId('diagram-zoom-in'));
    const zoomed = zoomOf();
    fireEvent.click(screen.getByTestId('diagram-zoom-out'));
    expect(zoomOf()).toBeLessThan(zoomed);
    fireEvent.click(screen.getByTestId('diagram-fit'));
    expect(zoomOf()).toBe(100);
    fireEvent.click(screen.getByTestId('diagram-zoom-in'));
    fireEvent.click(screen.getByTestId('node-api'));
    fireEvent.click(screen.getByTestId('diagram-reset'));
    expect(zoomOf()).toBe(100);
    expect(screen.getByTestId('detail-panel-empty')).toBeInTheDocument();
  });

  test('keyboard zoom: plus, minus and zero on the diagram', () => {
    renderPage();
    const diagram = screen.getByTestId('architecture-diagram');
    fireEvent.keyDown(diagram, { key: '+' });
    expect(zoomOf()).toBeGreaterThan(100);
    fireEvent.keyDown(diagram, { key: '-' });
    expect(zoomOf()).toBe(100);
    fireEvent.keyDown(diagram, { key: '+' });
    fireEvent.keyDown(diagram, { key: '0' });
    expect(zoomOf()).toBe(100);
  });

  test('a flow can be reached from the node panel by button', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('node-chat'));
    fireEvent.click(screen.getByTestId('flow-button-e-chat-ollama'));
    expect(screen.getByTestId('detail-panel')).toHaveTextContent(/Prompt sent to Ollama/i);
  });

  test('legend lists what is not present and does not draw it', () => {
    renderPage();
    const list = screen.getByTestId('not-present-list');
    expect(list).toHaveTextContent('Cloud LLM provider');
    expect(screen.queryByTestId('node-cloud-llm')).toBeNull();
  });

  test('narrow screens default to the accessible list and can switch to the diagram', () => {
    renderPage(390);
    expect(screen.getByTestId('component-list')).toBeInTheDocument();
    expect(screen.queryByTestId('architecture-diagram')).toBeNull();
    fireEvent.click(screen.getByTestId('list-node-agent'));
    expect(within(screen.getByTestId('detail-panel')).getByRole('heading', { name: NODE_BY_ID.agent.label })).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('view-diagram'));
    expect(screen.getByTestId('architecture-diagram')).toBeInTheDocument();
  });

  test('desktop users can switch to the list', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('view-list'));
    expect(screen.getByTestId('component-list')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('list-edge-e-api-chat'));
    expect(screen.getByTestId('detail-panel')).toBeInTheDocument();
  });
});

describe('frameworks', () => {
  test('category filter narrows the cards and the selection shows details', () => {
    renderPage();
    expect(screen.getAllByTestId(/^framework-card-/)).toHaveLength(FRAMEWORKS.length);
    fireEvent.click(screen.getByTestId('category-methodology'));
    const cards = screen.getAllByTestId(/^framework-card-/);
    expect(cards.length).toBeLessThan(FRAMEWORKS.length);
    expect(screen.queryByTestId('framework-card-saif')).toBeNull();
    fireEvent.click(screen.getByTestId('framework-card-stride'));
    expect(screen.getByTestId('framework-detail')).toHaveTextContent('STRIDE');
    fireEvent.click(screen.getByTestId('category-all'));
    expect(screen.getAllByTestId(/^framework-card-/)).toHaveLength(FRAMEWORKS.length);
  });

  test('SAIF detail names six elements, four component areas and the agent extension', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('framework-card-saif'));
    const extra = screen.getByTestId('saif-extra');
    ['Expand', 'Extend', 'Automate', 'Harmonize', 'Adapt', 'Contextualize'].forEach((w) => expect(extra).toHaveTextContent(w));
    ['Data', 'Infrastructure', 'Model', 'Application'].forEach((w) => expect(extra).toHaveTextContent(w));
    expect(extra).toHaveTextContent(/focus on agents/i);
    expect(extra).toHaveTextContent(/does not replace STRIDE/i);
  });

  test('AI Exchange detail does not present it as a component-level methodology', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('framework-card-owasp-ai-exchange'));
    expect(screen.getByTestId('aix-extra')).toHaveTextContent(/not a component-level threat modeling methodology/i);
    expect(screen.getByTestId('aix-extra')).toHaveTextContent('General controls');
  });

  test('comparison matrix is a table on desktop and stacked cards on narrow screens', () => {
    const { unmount } = renderPage();
    expect(screen.getByTestId('framework-matrix')).toBeInTheDocument();
    expect(screen.getByTestId('matrix-row-saif')).toBeInTheDocument();
    unmount();
    renderPage(390);
    expect(screen.getByTestId('framework-matrix-stacked')).toBeInTheDocument();
    expect(screen.queryByTestId('framework-matrix')).toBeNull();
  });

  test('selection guide updates the recommendation', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('guide-option-detailed-ai-guidance'));
    expect(screen.getByTestId('guide-primary')).toHaveTextContent('OWASP AI Exchange');
    fireEvent.click(screen.getByTestId('guide-option-locate-ai-risk'));
    expect(screen.getByTestId('guide-primary')).toHaveTextContent(/SAIF/);
    expect(screen.getByTestId('guide-complementary')).toBeInTheDocument();
  });
});

describe('scenarios', () => {
  test('all six scenarios are reachable by tab', () => {
    renderPage();
    expect(SCENARIOS).toHaveLength(6);
    SCENARIOS.forEach((s) => {
      fireEvent.click(screen.getByTestId(`scenario-tab-${s.id}`));
      expect(screen.getByRole('heading', { level: 3, name: `Scenario ${s.number}: ${s.title}` })).toBeInTheDocument();
      expect(screen.getByTestId(`scenario-${s.id}`)).toBeInTheDocument();
      expect(screen.getByTestId('attack-path').children.length).toBe(s.attackPath.length);
    });
  });

  test('groups expand and collapse so detail is progressive', () => {
    renderPage();
    const s = SCENARIOS[0];
    const summary = within(screen.getByTestId(`group-scenario-${s.id}-lenses`)).getAllByRole('button')[0];
    expect(summary).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'true');
    fireEvent.click(summary);
    expect(summary).toHaveAttribute('aria-expanded', 'false');
  });

  test('each scenario renders the five distinct framework lenses', () => {
    renderPage();
    SCENARIOS.forEach((s) => {
      fireEvent.click(screen.getByTestId(`scenario-tab-${s.id}`));
      ['discovery', 'context', 'saif', 'aix', 'risk'].forEach((lens) => expect(screen.getByTestId(`lens-${lens}`)).toBeInTheDocument());
      expect(screen.getAllByTestId('saif-risk').length).toBeGreaterThan(0);
    });
  });

  test('official SAIF mapping and analytical recommendations are labelled differently', () => {
    renderPage();
    const saif = screen.getByTestId('lens-saif');
    expect(saif).toHaveTextContent('Official SAIF risk to control mapping');
    expect(saif).toHaveTextContent('Analytical recommendations (not official mappings)');
    expect(within(saif).getAllByTestId('flag-analytical').length).toBeGreaterThan(0);
  });

  test('educational (by design) weaknesses are distinct from detected or unverified claims', () => {
    renderPage();
    fireEvent.click(screen.getByTestId('scenario-tab-agent-escalation'));
    const path = screen.getByTestId('attack-path');
    expect(within(path).getAllByTestId('flag-byDesign').length).toBeGreaterThan(0);
    expect(screen.getByText(/None of these are reported as detected vulnerabilities/i)).toBeInTheDocument();

    fireEvent.click(screen.getByTestId('scenario-tab-rag-injection'));
    const rows = within(screen.getByTestId('attack-path')).getAllByTestId('evidence-verified');
    expect(rows.length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('attack-path')).getAllByTestId('evidence-hypothesis').length).toBeGreaterThan(0);
    expect(within(screen.getByTestId('attack-path')).getAllByTestId('evidence-needs-validation').length).toBeGreaterThan(0);
  });

  test('mitigations are split into implemented and candidate', () => {
    renderPage();
    const list = screen.getByTestId('mitigations');
    expect(within(list).getAllByText('Implemented in AIGoat (teaching profile)').length).toBeGreaterThan(0);
    expect(within(list).getAllByText('Candidate (not implemented)').length).toBeGreaterThan(0);
  });

  test('scenario components link back to the diagram', () => {
    renderPage();
    act(() => {
      fireEvent.click(screen.getByTestId('scenario-component-ollama'));
    });
    expect(within(screen.getByTestId('detail-panel')).getByRole('heading', { name: NODE_BY_ID.ollama.label })).toBeInTheDocument();
  });
});

describe('references and why it matters', () => {
  test('references open in a new tab safely and the lifecycle is shown', () => {
    renderPage();
    const links = within(screen.getByTestId('refs-saif')).getAllByRole('link');
    expect(links.length).toBeGreaterThan(3);
    links.forEach((a) => {
      expect(a).toHaveAttribute('target', '_blank');
      expect(a.getAttribute('rel')).toMatch(/noopener/);
    });
    expect(screen.getByTestId('lifecycle').children.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByTestId('practice-table')).toBeInTheDocument();
  });
});
