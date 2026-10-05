import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { SectionCard, EmptyState } from '../common';
import HubLabCard from '../common/HubLabCard';
import McpFlow from '../common/McpFlow';
import { MCP_DECISIONS, MCP_FLOWS, MCP_ORDER, sortLabs } from '../../utils/labTeaching';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
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
                The attack surface is this MCP client. Each action spawns an allowlisted server, runs one call, and stops it. Tool descriptions are written by whoever shipped the server. Admins also have an assistant that is an MCP client for the Internal Management Server.
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
                  {first ? 'Open the first lab' : 'Browse MCP labs'}
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
              <McpFlow steps={MCP_FLOWS.hub.steps} caption={MCP_FLOWS.hub.caption} />
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
          <SectionCard title="Try every defense level">
            <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 1 }}>
              Re-run each lab at Level 0, Level 1, and Level 2. Note what still works. Defenses are not absolute.
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                Level 0 is the attack. The lab condition should be met.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                Level 1 pins a drifted description and blocks calls the lab marks as too strong.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                Level 2 also redacts instruction phrasing and credentials in tool results. A fixed word list does not check who a server is.
              </Typography>
            </Box>
          </SectionCard>
        </Box>

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
                A tool result is copied into the client as text. Read what came back, not only whether the call succeeded.
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
              {servers.map((server) => (
                <Box key={server.id} sx={{ py: 0.5 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{server.name}</Typography>
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

        <Box id="mcp-labs" sx={{ display: 'flex', flexDirection: 'column', gap: 3, mb: 4 }}>
          <Box>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Four decisions</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
              The labs stay in teaching order. A card that says "same decision" is one decision seen on another screen.
            </Typography>
          </Box>
          {MCP_DECISIONS.map((decision) => {
            const group = decision.labIds
              .map((id) => labs.find((lab) => lab.id === id))
              .filter(Boolean);
            if (!group.length) return null;
            return (
              <Box key={decision.title} sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                <Box>
                  <Typography sx={{ fontWeight: 700 }}>{decision.title}</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>{decision.detail}</Typography>
                </Box>
                {group.map((lab, index) => (
                  <HubLabCard key={lab.id} lab={lab} index={index + 1} />
                ))}
              </Box>
            );
          })}
          <SectionCard title="MCP05. We refused to build this" dense>
            <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 1.5 }}>
              Command injection would mean a tool argument reaches a shell. In a real client that looks like a tool such as run_command whose arguments are concatenated into a shell string. AIGoat does not ship that sink. The refused-executor lab asks for a shell tool and records the refusal, so you can see the control without an operating-system exploit.
            </Typography>
            <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 1.5 }}>
              Reflection: if a desktop agent let a tool description choose the shell command, which part would you pin, and which part would you refuse to implement at all?
            </Typography>
            <Button
              component={RouterLink}
              to="/labs/asi05-1"
              size="small"
              variant="outlined"
              endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
              sx={{ textTransform: 'none', fontWeight: 600 }}
            >
              Open the sandboxed executor lab
            </Button>
          </SectionCard>
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
