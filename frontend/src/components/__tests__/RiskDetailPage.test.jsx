import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import RiskDetailPage from '../RiskDetailPage';

jest.mock('../../config/api', () => ({
  __esModule: true,
  apiClient: { get: jest.fn(), post: jest.fn() },
  default: { ENDPOINTS: {} },
}));

const mockRisks = {
  'owasp-llm-2026:LLM01': {
    id: 'owasp-llm-2026:LLM01', code: 'LLM01', title: 'Prompt Injection', summary: 's', description: 'd', writeup: '', attack_surfaces: [], labs: [], challenges: [], related_risks: [],
  },
  'owasp-agentic-2026:ASI01': {
    id: 'owasp-agentic-2026:ASI01',
    code: 'ASI01',
    title: 'Agent Goal Hijack',
    summary: 'A crafted input replaces the stated objective.',
    description: 'Changing the goal is more damaging than changing a reply.',
    writeup: '',
    attack_surfaces: ['rag.kb', 'mcp.host'],
    labs: [
      { id: 'asi01-1', name: 'ASI01 - Planted Ticket', status: 'active', surface: 'mcp.host' },
      { id: 'llm01-1', name: 'LLM01 - Direct Injection', status: 'active', surface: 'chat.cracky' },
      { id: 'rag01-1', name: 'RAG01 - Poisoned Doc', status: 'active', surface: 'rag.kb' },
    ],
    challenges: [{ id: 7, title: 'Hijack the planner' }],
    related_risks: [
      { id: 'owasp-llm-2026:LLM01', code: 'LLM01', title: 'Prompt Injection', framework_id: 'owasp-llm-2026', framework_name: 'OWASP Top 10 for LLM Applications' },
    ],
  },
  'owasp-agentic-2026:ASI04': {
    id: 'owasp-agentic-2026:ASI04',
    code: 'ASI04',
    title: 'Supply Chain',
    summary: 'Tools change after approval.',
    description: 'A tool description is rewritten.',
    writeup: 'Step one.\nStep two.',
    attack_surfaces: [],
    labs: [],
    challenges: [],
    related_risks: [],
  },
};

jest.mock('../../hooks/useFrameworks', () => ({
  useRisk: (id) => ({ risk: mockRisks[id] || null, loading: false, error: mockRisks[id] ? null : new Error('x'), refetch: jest.fn() }),
}));

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const renderAt = (url) => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/owasp-top-10/:frameworkId/:riskCode" element={<RiskDetailPage />} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('RiskDetailPage', () => {
  it('shows the hero, counts and the main sections', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI01');
    expect(screen.getByRole('heading', { level: 1, name: /ASI01 Agent Goal Hijack/ })).toBeInTheDocument();
    expect(screen.getByText('A crafted input replaces the stated objective.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Description' })).toHaveTextContent('Changing the goal');
    expect(screen.getByRole('region', { name: 'Labs that teach this' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Challenges' })).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'How this works' })).not.toBeInTheDocument();
  });

  it('links labs and challenges to their existing destinations', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI01');
    const labs = within(screen.getByRole('region', { name: 'Labs that teach this' }));
    expect(labs.getByRole('link', { name: /ASI01 - Planted Ticket/ })).toHaveAttribute('href', '/labs/asi01-1');
    expect(labs.getByRole('link', { name: /LLM01 - Direct Injection/ })).toHaveAttribute('href', '/attacks?lab=llm01-1');
    expect(labs.getByRole('link', { name: /RAG01 - Poisoned Doc/ })).toHaveAttribute('href', '/knowledge-base?lab=rag01-1');
    const challenges = within(screen.getByRole('region', { name: 'Challenges' }));
    expect(challenges.getByRole('link', { name: /Hijack the planner/ })).toHaveAttribute('href', '/challenges?id=7');
  });

  it('keeps Try in Attack Lab, surface chips and related-risk navigation', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI01');
    const rail = within(screen.getByRole('complementary', { name: 'Risk context' }));
    expect(rail.getByRole('link', { name: 'rag.kb' }).getAttribute('href')).toMatch(/^\/attacks/);
    fireEvent.click(rail.getByText('LLM01'));
    expect(screen.getByRole('heading', { level: 1, name: /LLM01 Prompt Injection/ })).toBeInTheDocument();
  });

  it('navigates to the attack lab from the hero button', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI01');
    fireEvent.click(screen.getByRole('button', { name: /Try in Attack Lab/ }));
    expect(screen.getByTestId('where').textContent).toBe('/attacks?framework=owasp-agentic-2026');
  });

  it('breadcrumbs go back to the framework list', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI01');
    expect(screen.getByRole('link', { name: 'Frameworks' })).toHaveAttribute('href', '/owasp-top-10');
    expect(screen.getByRole('link', { name: 'Agentic 2026' })).toHaveAttribute('href', '/owasp-top-10?framework=owasp-agentic-2026');
  });

  it('renders the write-up and empty states without a lab button', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI04');
    expect(screen.getByRole('region', { name: 'How this works' })).toHaveTextContent('Step one.');
    expect(screen.getByText('No labs mapped to this risk yet.')).toBeInTheDocument();
    expect(screen.getByText('No challenges mapped to this risk yet.')).toBeInTheDocument();
    expect(screen.getByText('No cross-framework relatives recorded.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Try in Attack Lab/ })).not.toBeInTheDocument();
  });

  it('shows Risk not found for an unknown id', () => {
    renderAt('/owasp-top-10/owasp-agentic-2026/ASI99');
    expect(screen.getByText('Risk not found')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Back to frameworks' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/owasp-top-10');
  });
});
