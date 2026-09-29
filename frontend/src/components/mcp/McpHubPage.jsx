import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, Collapse, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon, ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { SectionCard, EmptyState } from '../common';
import HubLabCard from '../common/HubLabCard';
import { MCP_ORDER, sortLabs } from '../../utils/labTeaching';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const trustColor = (tier) => {
  if (tier === 'official') return 'success';
  if (tier === 'untrusted') return 'error';
  return 'warning';
};

const MCP_STEPS = [
  'The attack surface is the MCP client console, and for Admin the assistant at /admin/assistant.',
  'Tool descriptions and ticket text are attacker-controlled. Do not treat them as instructions.',
  'Defense levels change pinning and redaction. Level 2 also pauses refund and export calls.',
];

const McpHubPage = () => {
  const clientLabs = useLabs({ surface: 'mcp.client' });
  const hostLabs = useLabs({ surface: 'mcp.host' });
  const labs = sortLabs(
    [...clientLabs.labs, ...hostLabs.labs.filter((lab) => String(lab.id).startsWith('mcp'))],
    MCP_ORDER,
  );
  const loading = clientLabs.loading || hostLabs.loading;
  const error = clientLabs.error || hostLabs.error;
  const refetch = () => { clientLabs.refetch(); hostLabs.refetch(); };
  const first = labs[0];
  const [servers, setServers] = useState([]);
  const [serversError, setServersError] = useState(null);
  const [openCommandId, setOpenCommandId] = useState(null);

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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 4 } }}>
      <Container maxWidth="md">
        <Box
          sx={{
            mb: 3,
            p: { xs: 2.5, md: 3 },
            borderRadius: '16px',
            border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
            background: (t) => (t.palette.mode === 'dark'
              ? 'linear-gradient(145deg, rgba(99,102,241,0.16) 0%, rgba(18,18,30,0.4) 55%)'
              : 'linear-gradient(145deg, rgba(79,70,229,0.08) 0%, rgba(255,255,255,0.65) 58%)'),
          }}
        >
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.05fr 0.95fr' }, gap: { xs: 2.5, md: 3 }, alignItems: 'center' }}>
            <Box>
              <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'primary.main', mb: 1 }}>
                MCP security
              </Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '1.7rem', md: '2.15rem' }, mb: 1 }}>
                MCP client
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '1rem', lineHeight: 1.65, mb: 2 }}>
                The attack surface is this MCP client. Each action spawns an allowlisted server, runs one call, and stops it. Tool descriptions are written by whoever shipped the server. Admins also have an assistant that is an MCP client for the internal shop server.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
                {MCP_STEPS.map((step, index) => (
                  <Box key={step} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                    <Box sx={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0, mt: 0.15,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8125rem', fontWeight: 700,
                      color: 'primary.main',
                      bgcolor: (t) => (t.palette.mode === 'dark' ? 'rgba(129,140,248,0.16)' : 'rgba(79,70,229,0.1)'),
                    }}
                    >
                      {index + 1}
                    </Box>
                    <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.5 }}>{step}</Typography>
                  </Box>
                ))}
              </Box>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  component={RouterLink}
                  to={first ? `/labs/${first.id}` : '/attacks?framework=owasp-mcp-2025'}
                  variant="contained"
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {first ? 'Start with the decoy token' : 'Browse MCP labs'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => document.getElementById('mcp-labs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Labs on this page
                </Button>
              </Box>
              {first && (
                <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mt: 1.25 }}>
                  First lab: {first.name}
                </Typography>
              )}
            </Box>
            <Box>
              <Box
                component="img"
                src="/media/diagrams/mcp-stateless-call.svg"
                alt="Learner action spawns a stdio MCP server, runs one JSON-RPC, then reaps the process."
                sx={{ width: '100%', display: 'block' }}
              />
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mt: 1, lineHeight: 1.5 }}>
                Spec revision 2026-07-28 is stateless. There is no session to poison between calls.
              </Typography>
            </Box>
          </Box>
        </Box>

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
          <SectionCard title="What to watch">
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                Tool descriptions render verbatim. Read them as attacker-controlled text.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                A description can change between two <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>tools/list</Box> calls.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                A result can carry a decoy token that looks like a flag.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                A second server can shadow a tool name you already trusted.
              </Typography>
            </Box>
          </SectionCard>
        </Box>

        <Box sx={{ mb: 3 }}>
          <SectionCard title="Allowlisted servers">
            {!servers.length && !serversError && (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                Loading server list.
              </Typography>
            )}
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              {servers.map((server) => {
                const redacted = Array.isArray(server.command_display_redacted)
                  ? server.command_display_redacted
                  : null;
                const open = openCommandId === server.id;
                return (
                  <Box key={server.id} sx={{ py: 0.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{server.name}</Typography>
                      <Chip size="small" label={server.trust_tier} color={trustColor(server.trust_tier)} />
                    </Box>
                    {redacted && redacted.length > 0 && (
                      <>
                        <Button
                          size="small"
                          onClick={() => setOpenCommandId(open ? null : server.id)}
                          endIcon={(
                            <ExpandMoreIcon
                              sx={{
                                fontSize: '1rem !important',
                                transform: open ? 'rotate(180deg)' : 'none',
                                transition: 'transform 0.15s',
                              }}
                            />
                          )}
                          sx={{
                            textTransform: 'none',
                            fontWeight: 600,
                            fontSize: '0.9375rem',
                            color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                            px: 0,
                            minWidth: 0,
                          }}
                        >
                          What actually runs
                        </Button>
                        <Collapse in={open}>
                          <Typography
                            sx={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontSize: '0.9375rem',
                              color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-all',
                              mt: 0.5,
                            }}
                          >
                            {redacted.join(' ')}
                          </Typography>
                        </Collapse>
                      </>
                    )}
                  </Box>
                );
              })}
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

        <Box id="mcp-labs" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Do these in order</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 0.5 }}>
            A card that says "same idea" is one attack seen again, not a new topic.
          </Typography>
          {labs.map((lab, index) => <HubLabCard key={lab.id} lab={lab} index={index + 1} />)}
        </Box>

        <Button
          component={RouterLink}
          to="/attacks?framework=owasp-mcp-2025"
          variant="outlined"
          size="small"
          endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
          sx={{ textTransform: 'none', fontWeight: 600 }}
        >
          MCP labs on Attack Labs
        </Button>
      </Container>
    </Box>
  );
};

export default McpHubPage;
