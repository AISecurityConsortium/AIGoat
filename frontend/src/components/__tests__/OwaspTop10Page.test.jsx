import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import OwaspTop10Page from '../OwaspTop10Page';

jest.mock('../../config/api', () => ({
  __esModule: true,
  apiClient: { get: jest.fn(), post: jest.fn() },
  default: { ENDPOINTS: {} },
}));

const mockFrameworks = [
  { id: 'owasp-agentic-2026', name: 'OWASP Top 10 for Agentic Applications', version: '2026' },
  { id: 'owasp-llm-2026', name: 'OWASP Top 10 for LLM Applications', version: '2026' },
  { id: 'owasp-mcp-2025', name: 'OWASP MCP Top 10', version: '2025' },
];

const mockDetails = {
  'owasp-llm-2026': {
    id: 'owasp-llm-2026',
    name: 'OWASP Top 10 for LLM Applications',
    version: '2026',
    status: 'stable',
    publisher: 'OWASP GenAI Security Project',
    attribution: 'OWASP GenAI Security Project. (2026).',
    source_license: 'CC-BY-SA-4.0',
    url: 'https://genai.owasp.org/llm-top-10/',
    risks: [
      { id: 'owasp-llm-2026:LLM01', code: 'LLM01', title: 'Prompt Injection', summary: 'Crafted input overrides instructions.', lab_ids: ['llm01-1', 'llm01-2'], challenge_ids: [1], attack_surfaces: ['chat.completion'] },
      { id: 'owasp-llm-2026:LLM02', code: 'LLM02', title: 'Sensitive Information Disclosure', summary: 'The model reveals secrets.', lab_ids: [], challenge_ids: [] },
    ],
  },
  'owasp-mcp-2025': {
    id: 'owasp-mcp-2025',
    name: 'OWASP MCP Top 10',
    version: '2025',
    status: 'beta',
    maturity_note: 'This list is a beta.',
    attribution: 'OWASP Foundation.',
    source_license: 'CC-BY-NC-SA-4.0',
    risks: [
      { id: 'owasp-mcp-2025:MCP01', code: 'MCP01', title: 'Token Mismanagement', summary: 'Secrets in tool results.', lab_ids: ['mcp01-1'], challenge_ids: [] },
    ],
  },
};

jest.mock('../../hooks/useFrameworks', () => ({
  useFrameworks: () => ({ frameworks: mockFrameworks, loading: false, error: null, refetch: jest.fn() }),
  useFramework: (id) => ({ framework: mockDetails[id] || null, loading: false, error: null, refetch: jest.fn() }),
}));

const list = () => within(screen.getByRole('tabpanel'));

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const renderPage = (url = '/owasp-top-10') => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/owasp-top-10" element={<><OwaspTop10Page /><Where /></>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('OWASP Top 10 page', () => {
  test('has the hero, the framework tabs in canonical order, and the LLM change list', () => {
    renderPage();
    expect(screen.getByRole('heading', { level: 1, name: 'AI Security Frameworks' })).toBeInTheDocument();
    const tabs = screen.getAllByRole('tab');
    expect(tabs.map((tab) => tab.textContent)).toEqual([
      '2026Top 10',
      '2025MCP Top 10',
      '2026Top 10 for Agentic Applications',
    ]);
    expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
    const rail = screen.getByRole('complementary', { name: 'Framework details' });
    expect(within(rail).getByRole('heading', { name: 'What changed from 2025 to 2026' })).toBeInTheDocument();
    expect(within(rail).getByText('OWASP Top 10 for LLM Applications')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Official list/ })).toHaveAttribute('href', 'https://genai.owasp.org/llm-top-10/');
  });

  test('switching framework updates the URL and the risk list', () => {
    renderPage();
    fireEvent.click(screen.getByRole('tab', { name: /MCP Top 10/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/owasp-top-10?framework=owasp-mcp-2025');
    expect(list().getByText('Token Mismanagement')).toBeInTheDocument();
    expect(list().queryByText('Prompt Injection')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'What changed from 2025 to 2026' })).not.toBeInTheDocument();
    expect(screen.getByText('This list is a beta.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Practice on the MCP page' })).toHaveAttribute('href', '/mcp');
  });

  test('the filter narrows the list and is kept in the q param', () => {
    renderPage();
    fireEvent.change(screen.getByLabelText('Filter risks'), { target: { value: 'secrets' } });
    expect(list().getByText('Sensitive Information Disclosure')).toBeInTheDocument();
    expect(list().queryByText('Prompt Injection')).not.toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('q=secrets');
    fireEvent.change(screen.getByLabelText('Filter risks'), { target: { value: 'zzzz' } });
    expect(screen.getByText('No risks match')).toBeInTheDocument();
  });

  test('a risk links to its detail page and to Attack Labs filtered by that risk', () => {
    renderPage('/owasp-top-10?framework=owasp-llm-2026');
    fireEvent.click(list().getByText('Prompt Injection'));
    fireEvent.click(screen.getByRole('button', { name: /View risk/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/owasp-top-10/owasp-llm-2026/LLM01');
  });

  test('Try in Attack Lab only appears for risks that have labs, and Launch Attack Labs goes to /attacks', () => {
    renderPage();
    fireEvent.click(list().getByText('Prompt Injection'));
    fireEvent.click(list().getByText('Sensitive Information Disclosure'));
    expect(screen.getAllByRole('button', { name: /Try in Attack Lab/ })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: /Launch Attack Labs/ }));
    expect(screen.getByTestId('where')).toHaveTextContent('/attacks');
  });
});
