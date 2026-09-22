import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Chip, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { PageHeader, SectionCard, RiskChip, DifficultyChip, EmptyState } from '../common';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const oneLine = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';

const trustColor = (tier) => {
  if (tier === 'official') return 'success';
  if (tier === 'untrusted') return 'error';
  return 'warning';
};

const HubLabCard = ({ lab }) => {
  const code = (lab.primary_risk || '').includes(':')
    ? lab.primary_risk.split(':').slice(1).join(':')
    : (lab.owasp || '');
  return (
    <SectionCard dense>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }}>{lab.name}</Typography>
        {code && <RiskChip code={code} />}
        {lab.difficulty && <DifficultyChip difficulty={lab.difficulty} />}
      </Box>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', lineHeight: 1.5, mb: 1.5 }}>
        {oneLine(lab.objective) || lab.description}
      </Typography>
      <Button
        component={RouterLink}
        to={`/labs/${lab.id}`}
        size="small"
        variant="outlined"
        endIcon={<ArrowForwardIcon sx={{ fontSize: '0.8rem !important' }} />}
        sx={{ textTransform: 'none', fontWeight: 600 }}
      >
        Open console
      </Button>
    </SectionCard>
  );
};

HubLabCard.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string.isRequired,
    name: PropTypes.string,
    primary_risk: PropTypes.string,
    owasp: PropTypes.string,
    difficulty: PropTypes.string,
    objective: PropTypes.string,
    description: PropTypes.string,
  }).isRequired,
};

const McpHubPage = () => {
  const { labs, loading, error, refetch } = useLabs({ surface: 'mcp.client' });
  const [servers, setServers] = useState([]);
  const [serversError, setServersError] = useState(null);

  const loadServers = useCallback(async () => {
    try {
      const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.MCP_SERVERS, {
        headers: authHeaders(),
      });
      setServers(Array.isArray(data) ? data : []);
      setServersError(null);
    } catch (err) {
      setServersError(err);
      setServers([]);
    }
  }, []);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <PageHeader
          title="MCP client"
          subtitle="Spec revision 2026-07-28 is stateless, so every action spawns the stdio server, runs one RPC, and reaps it."
        />

        {(error || serversError) && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={<Button color="inherit" size="small" onClick={() => { refetch(); loadServers(); }}>Retry</Button>}
          >
            Could not load MCP data. Confirm you are signed in and the API is running.
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <SectionCard title="One action, one child">
            <Box
              component="img"
              src="/media/diagrams/mcp-stateless-call.svg"
              alt="Learner action spawns a stdio MCP server, runs one JSON-RPC, then reaps the process."
              sx={{ width: '100%', maxWidth: 720, display: 'block', mx: 'auto' }}
            />
          </SectionCard>
        </Box>

        <Box sx={{ mb: 3 }}>
          <SectionCard title="What to watch">
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 0.75 }}>
                Tool descriptions render verbatim. Read them as attacker-controlled text.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 0.75 }}>
                A description can change between two <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>tools/list</Box> calls.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 0.75 }}>
                A result can carry a decoy token that looks like a flag.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                A second server can shadow a tool name you already trusted.
              </Typography>
            </Box>
          </SectionCard>
        </Box>

        <Box sx={{ mb: 3 }}>
          <SectionCard title="Allowlisted servers">
            {!servers.length && !serversError && (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem' }}>
                Loading server list.
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {servers.map((server) => (
                <Box key={server.id} sx={{ py: 0.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.9rem' }}>{server.name}</Typography>
                    <Typography sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace', fontSize: '0.75rem', color: 'text.secondary' }}>
                      {server.id}
                    </Typography>
                    <Chip size="small" label={server.trust_tier} color={trustColor(server.trust_tier)} />
                  </Box>
                  <Typography
                    sx={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontSize: '0.75rem',
                      color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {(server.command_display || []).join(' ')}
                  </Typography>
                </Box>
              ))}
            </Box>
          </SectionCard>
        </Box>

        {loading && !labs.length && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            {[0, 1].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}
          </Box>
        )}

        {!loading && !labs.length && !error && (
          <EmptyState title="No MCP labs" description="The mcp.client surface has no labs yet." />
        )}

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          {labs.map((lab) => <HubLabCard key={lab.id} lab={lab} />)}
        </Box>

        <Button
          component={RouterLink}
          to="/attacks?framework=owasp-mcp-2025"
          variant="outlined"
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: '0.75rem !important' }} />}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          MCP labs on Attack Labs
        </Button>
      </Container>
    </Box>
  );
};

export default McpHubPage;
