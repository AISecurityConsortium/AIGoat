import React from 'react';
import { act, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import McpHubPage from '../../mcp/McpHubPage';
import AgentHubPage from '../../agent/AgentHubPage';
import { AGENT_NAV_GROUPS, AGENT_ORDER, MCP_DECISIONS, MCP_ORDER } from '../../../utils/labTeaching';

jest.mock('../../../config/api', () => {
  const get = jest.fn();
  return {
    __esModule: true,
    apiClient: { get, post: jest.fn() },
    default: { ENDPOINTS: { MCP_SERVERS: '/api/mcp/servers' } },
  };
});

const mkLab = (id, surface) => ({
  id,
  name: `${id.toUpperCase()} - Lab name`,
  surface,
  difficulty: 'beginner',
  primary_risk: 'owasp-mcp-2025:MCP01',
  description: `Description ${id}`,
  expected_by_level: { 0: 'Works at level zero.' },
});

const mockMcpLabs = MCP_ORDER.map((id) => mkLab(id, 'mcp.client'));
const mockAgentLabs = AGENT_ORDER.filter((id) => id !== 'killchain-1').map((id) => mkLab(id, 'agent.runner'));

jest.mock('../../../hooks/useLabs', () => ({
  useLabs: (filters = {}) => {
    const labs = {
      'mcp.client': mockMcpLabs,
      'mcp.host': [],
      'agent.runner': mockAgentLabs,
    }[filters.surface] || [];
    return { labs, loading: false, error: null, refetch: jest.fn() };
  },
  invalidateLabsCache: jest.fn(),
}));

// eslint-disable-next-line import/first
import { apiClient } from '../../../config/api';

const renderHub = async (Page) => {
  await act(async () => {
    render(
      <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Page />
      </MemoryRouter>,
    );
  });
};

beforeEach(() => {
  apiClient.get.mockReset();
  apiClient.get.mockResolvedValue({ data: [{ id: 'shop', name: 'Shop Catalog Server' }, { id: 'support', name: 'Support Server' }] });
});

describe('MCP landing page', () => {
  test('has the hero, grouped lab cards, and a guidance rail', async () => {
    await renderHub(McpHubPage);
    expect(screen.getByRole('heading', { level: 1, name: 'MCP client' })).toBeInTheDocument();
    MCP_DECISIONS.forEach((decision) => {
      expect(screen.getByRole('region', { name: decision.title })).toBeInTheDocument();
    });
    const rail = screen.getByRole('complementary', { name: 'MCP guidance and servers' });
    expect(within(rail).getByRole('heading', { name: 'Try every defense level' })).toBeInTheDocument();
    expect(within(rail).getByRole('heading', { name: 'What to watch' })).toBeInTheDocument();
    expect(await within(rail).findByText('Shop Catalog Server')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open the first lab' })).toHaveAttribute('href', `/labs/${MCP_ORDER[0]}`);
    // Every lab is reachable from a card.
    expect(screen.getAllByRole('link', { name: 'Open lab' }).length).toBeGreaterThan(5);
    expect(screen.getByText('MCP05. We refused to build this')).toBeInTheDocument();
  });
});

describe('Agent landing page', () => {
  test('has the hero, one section per decision group, and a guidance rail', async () => {
    await renderHub(AgentHubPage);
    expect(screen.getByRole('heading', { level: 1, name: 'Shop agent' })).toBeInTheDocument();
    AGENT_NAV_GROUPS.filter((group) => group.id !== 'capstone').forEach((group) => {
      expect(screen.getByRole('region', { name: group.title })).toBeInTheDocument();
    });
    const rail = screen.getByRole('complementary', { name: 'Agent guidance' });
    expect(within(rail).getByRole('heading', { name: 'Try every defense level' })).toBeInTheDocument();
    expect(within(rail).getByRole('heading', { name: 'What to watch' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start with the refund' })).toHaveAttribute('href', `/labs/${AGENT_NAV_GROUPS[0].labs[0]}`);
    expect(screen.getByRole('link', { name: 'Open the admin assistant' })).toHaveAttribute('href', '/admin/assistant');
  });
});
