import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ChallengePage from '../ChallengePage';
import { apiClient } from '../../config/api';

jest.mock('../../config/api', () => ({
  __esModule: true,
  apiClient: { get: jest.fn(), post: jest.fn() },
  getApiUrl: (path) => path,
  default: { ENDPOINTS: {} },
}));

jest.mock('../killchain/KillChainWorkbench', () => ({ __esModule: true, default: () => <div>kill chain workbench</div> }));

const challenges = [
  { id: 1, title: 'Prompt Injection', description: 'Make Cracky ignore its rules.', difficulty: 'beginner', owasp_ref: 'LLM01', points: 100, completed: true, started: true, hints: ['Try role play'] },
  { id: 3, title: 'RAG Knowledge Poisoning', description: 'Poison the KB.', difficulty: 'beginner', owasp_ref: 'LLM09', points: 150, completed: false, started: false, hints: [] },
  { id: 5, title: 'Multi-turn Escalation', description: 'Escalate over turns.', difficulty: 'intermediate', owasp_ref: 'LLM01', points: 250, completed: false, started: false, hints: [] },
];

const Where = () => {
  const location = useLocation();
  return <div data-testid="where">{location.pathname + location.search}</div>;
};

const renderAt = (url = '/challenges') => render(
  <MemoryRouter initialEntries={[url]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Routes>
      <Route path="/challenges" element={<><ChallengePage /><Where /></>} />
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>,
);

describe('ChallengePage', () => {
  beforeEach(() => {
    apiClient.get.mockReset();
    apiClient.post.mockReset();
    apiClient.get.mockResolvedValue({ data: challenges });
  });

  it('shows the hero, progress, points and challenges grouped by difficulty', async () => {
    renderAt();
    expect(await screen.findByRole('heading', { level: 1, name: 'Security Challenges' })).toBeInTheDocument();
    expect(screen.getByText(/across 3 challenges/)).toBeInTheDocument();
    expect(screen.getByText('1 of 3 completed')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();
    const beginner = within(screen.getByRole('region', { name: 'Beginner challenges' }));
    expect(beginner.getByText('Prompt Injection')).toBeInTheDocument();
    expect(beginner.getByText('RAG Knowledge Poisoning')).toBeInTheDocument();
    expect(beginner.getByText('KB')).toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Intermediate challenges' })).getByText('Multi-turn Escalation')).toBeInTheDocument();
  });

  it('filters by completion state', async () => {
    renderAt();
    await screen.findByText('Prompt Injection');
    fireEvent.click(screen.getByRole('button', { name: 'Completed' }));
    expect(screen.getByText('Prompt Injection')).toBeInTheDocument();
    expect(screen.queryByText('Multi-turn Escalation')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Expert' }));
    expect(screen.getByText('No challenges match your filter.')).toBeInTheDocument();
  });

  it('opens a challenge from a card, by keyboard, and by ?id=', async () => {
    const first = renderAt();
    fireEvent.click(await screen.findByRole('button', { name: 'Open challenge RAG Knowledge Poisoning' }));
    expect(screen.getByRole('button', { name: /Start Challenge/ })).toBeInTheDocument();
    first.unmount();

    const second = renderAt();
    fireEvent.keyDown(await screen.findByRole('button', { name: 'Open challenge Multi-turn Escalation' }), { key: 'Enter' });
    expect(screen.getByRole('button', { name: /Start Challenge/ })).toBeInTheDocument();
    second.unmount();

    renderAt('/challenges?id=1');
    expect(await screen.findByText('Challenge solved! Points have been awarded.')).toBeInTheDocument();
  });

  it('starts a challenge through the existing endpoint', async () => {
    apiClient.post.mockResolvedValue({ data: { exploit_triggered: false } });
    renderAt('/challenges?id=3');
    fireEvent.click(await screen.findByRole('button', { name: /Start Challenge/ }));
    await waitFor(() => expect(apiClient.post).toHaveBeenCalled());
    expect(apiClient.post.mock.calls[0][0]).toBe('/api/workshop/challenges/3/start');
  });

  it('keeps the kill chain entry points', async () => {
    renderAt();
    await screen.findByText('Prompt Injection');
    expect(screen.getByText('Agentic Kill Chain')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Open the kill chain' }));
    expect(screen.getByTestId('where')).toHaveTextContent('/challenges?killchain=1');
    expect(await screen.findByText('kill chain workbench')).toBeInTheDocument();
  });

  it('shows a login hint when the API returns 401', async () => {
    apiClient.get.mockRejectedValue({ response: { status: 401 } });
    renderAt();
    expect(await screen.findByText('Please log in to view challenges.')).toBeInTheDocument();
    expect(screen.queryByText('No challenges match your filter.')).not.toBeInTheDocument();
  });
});
