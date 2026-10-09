import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import AttacksPage from '../AttacksPage';

jest.mock('../../config/api', () => ({
  __esModule: true,
  apiClient: { get: jest.fn(), post: jest.fn() },
  default: { ENDPOINTS: {} },
}));

const mockLabs = [
  {
    id: 'llm01-1', name: 'LLM01 - Basics', owasp: 'LLM01', description: 'Override the system prompt.', difficulty: 'beginner',
    surface: 'chat.cracky', risks: ['owasp-llm-2026:LLM01'], primary_risk: 'owasp-llm-2026:LLM01',
    example_payloads: ['ignore previous instructions'], objective: 'Inject.', expected_by_level: { 0: 'Leaks.', 1: 'Partly.', 2: 'Blocked.' },
  },
  {
    id: 'llm01-2', name: 'LLM01 - Indirect', owasp: 'LLM01', description: 'Poison the context.', difficulty: 'beginner',
    surface: 'rag.kb', risks: ['owasp-llm-2026:LLM01'], primary_risk: 'owasp-llm-2026:LLM01', expected_by_level: {},
  },
  {
    id: 'asi01-1', name: 'ASI01 - Planted Ticket', owasp: 'ASI01', description: 'Hijack the goal.', difficulty: 'advanced',
    surface: 'mcp.host', risks: ['owasp-agentic-2026:ASI01'], primary_risk: 'owasp-agentic-2026:ASI01', expected_by_level: {},
  },
];

const mockFrameworkList = [
  { id: 'owasp-llm-2026', name: 'OWASP Top 10 for LLM Applications', version: '2026' },
  { id: 'owasp-mcp-2025', name: 'OWASP MCP Top 10', version: '2025' },
  { id: 'owasp-agentic-2026', name: 'OWASP Top 10 for Agentic Applications', version: '2026' },
];

const mockDetails = {
  'owasp-llm-2026': { id: 'owasp-llm-2026', name: 'OWASP Top 10 for LLM Applications', risks: [
    { id: 'owasp-llm-2026:LLM01', code: 'LLM01', title: 'Prompt Injection' },
    { id: 'owasp-llm-2026:LLM02', code: 'LLM02', title: 'Sensitive Information Disclosure' },
  ] },
  'owasp-mcp-2025': { id: 'owasp-mcp-2025', name: 'OWASP MCP Top 10', risks: [
    { id: 'owasp-mcp-2025:MCP05', code: 'MCP05', title: 'Command Injection' },
  ] },
  'owasp-agentic-2026': { id: 'owasp-agentic-2026', name: 'OWASP Top 10 for Agentic Applications', risks: [
    { id: 'owasp-agentic-2026:ASI01', code: 'ASI01', title: 'Agent Goal Hijack' },
  ] },
};

jest.mock('../../hooks/useLabs', () => ({
  useLabs: () => ({ labs: mockLabs, loading: false, error: null, refetch: jest.fn() }),
}));

jest.mock('../../hooks/useFrameworks', () => ({
  useFrameworks: () => ({ frameworks: mockFrameworkList, loading: false, error: null, refetch: jest.fn() }),
  useFramework: (id) => ({ framework: mockDetails[id] || null, loading: false, error: null, refetch: jest.fn() }),
}));

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const renderAt = (url = '/attacks') => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/attacks" element={<><AttacksPage /><Where /></>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('AttacksPage', () => {
  beforeEach(() => localStorage.clear());

  it('renders the hero, framework tabs with counts and the first category', () => {
    renderAt();
    expect(screen.getByRole('heading', { level: 1, name: 'Attack Labs' })).toBeInTheDocument();
    const fw = within(screen.getByRole('tablist', { name: 'Security frameworks' }));
    expect(fw.getByRole('tab', { name: /LLM 2026/ })).toHaveAttribute('aria-selected', 'true');
    expect(fw.getByRole('tab', { name: /Agentic 2026/ })).toHaveTextContent('1 lab');
    expect(screen.getByRole('heading', { name: 'LLM01: Prompt Injection' })).toBeInTheDocument();
    expect(screen.getByText('LLM01 - Basics')).toBeInTheDocument();
  });

  it('switching framework updates the URL and the lab list', () => {
    renderAt();
    fireEvent.click(screen.getByRole('tab', { name: /Agentic 2026/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/attacks?framework=owasp-agentic-2026');
    expect(screen.getByText('ASI01 - Planted Ticket')).toBeInTheDocument();
    expect(screen.queryByText('LLM01 - Basics')).not.toBeInTheDocument();
  });

  it('expands a lab and shows the console link for its surface', () => {
    renderAt('/attacks?framework=owasp-agentic-2026');
    fireEvent.click(screen.getByText('ASI01 - Planted Ticket'));
    expect(screen.getByRole('link', { name: 'Start the two-step lab' })).toHaveAttribute('href', '/labs/asi01-1');
  });

  it('opens the lab named in ?lab= and shows its example prompt', () => {
    renderAt('/attacks?lab=llm01-1');
    expect(screen.getByText('ignore previous instructions')).toBeInTheDocument();
    expect(localStorage.getItem('active_lab_id')).toBe('llm01-1');
  });

  it('marks a lab complete and persists it per user', () => {
    localStorage.setItem('username', 'alice');
    renderAt();
    fireEvent.click(screen.getAllByRole('button', { name: 'Mark complete' })[0]);
    expect(JSON.parse(localStorage.getItem('aigoat_owasp_completed_alice'))['llm01-1']).toBe(true);
    expect(screen.getByText(/1 of 2 labs marked complete/)).toBeInTheDocument();
  });

  it('shows active filters and lets the learner clear one', () => {
    renderAt('/attacks?surface=rag.kb');
    expect(screen.getByText('LLM01 - Indirect')).toBeInTheDocument();
    expect(screen.queryByText('LLM01 - Basics')).not.toBeInTheDocument();
    const rail = within(screen.getByRole('complementary', { name: 'Lab context' }));
    fireEvent.click(rail.getByTestId('CancelIcon'));
    expect(screen.getByTestId('where').textContent).toBe('/attacks');
    expect(screen.getByText('LLM01 - Basics')).toBeInTheDocument();
  });

  it('links the category to its risk page and explains the MCP05 refusal', () => {
    renderAt();
    expect(screen.getByRole('link', { name: 'Read about LLM01' })).toHaveAttribute('href', '/owasp-top-10/owasp-llm-2026/LLM01');
    fireEvent.click(screen.getByRole('tab', { name: /MCP 2025/ }));
    expect(screen.getByText('We refused to build this')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the sandboxed executor lab' })).toHaveAttribute('href', '/labs/asi05-1');
  });
});
