import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { SectionCard, EmptyState } from '../common';
import HubHero from '../common/HubHero';
import HubLabGroups from '../common/HubLabGroups';
import HubRail, { RailPanel } from '../common/HubRail';
import { mono } from '../common/panelStyles';
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

const MCP_GROUPS = MCP_DECISIONS.map((decision) => ({
  id: decision.title,
  title: decision.title,
  detail: decision.detail,
  labs: decision.labIds,
}));

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
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 2, md: 2 } }}>
      <Container maxWidth="xl">
        <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
          <HubHero
            eyebrow="MCP security"
            title="MCP client"
            description="The attack surface is this MCP client. Each action spawns an allowlisted server, runs one call, and stops it. Tool descriptions are written by whoever shipped the server. Admins also have an assistant that is an MCP client for the Internal Management Server."
            steps={MCP_STEPS}
            flow={MCP_FLOWS.hub}
            note={first ? `First lab: ${first.name}` : ''}
            actions={(
              <>
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
              </>
            )}
          />

          {(error || serversError) && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={<Button color="inherit" size="small" onClick={() => { refetch(); loadServers(); }}>Retry</Button>}
            >
              Could not load MCP data. Confirm you are signed in and the API is running.
            </Alert>
          )}

          <Box
            sx={{
              display: 'grid',
              gap: 1.5,
              alignItems: 'start',
              gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(300px, 3fr)', lg: 'minmax(0, 7fr) minmax(340px, 3fr)' },
            }}
          >
            <Box id="mcp-labs" sx={{ minWidth: 0, scrollMarginTop: '72px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>Four decisions</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                  The labs stay in teaching order. A card that says "same decision" is one decision seen on another screen.
                </Typography>
              </Box>

              {loading && !labs.length && (
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={140} />)}
                </Box>
              )}

              {!loading && !labs.length && !error && (
                <EmptyState title="No MCP labs" description="The mcp.client surface has no labs yet." />
              )}

              <HubLabGroups groups={MCP_GROUPS} labs={labs} />

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

              <Box>
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
              </Box>
            </Box>

            <HubRail label="MCP guidance and servers">
              <RailPanel
                title="Try every defense level"
                lead="Re-run each lab at Level 0, Level 1, and Level 2. Note what still works. Defenses are not absolute."
                items={[
                  'Level 0 is the attack. The lab condition should be met.',
                  'Level 1 pins a drifted description and blocks calls the lab marks as too strong.',
                  'Level 2 also redacts instruction phrasing and credentials in tool results. A fixed word list does not check who a server is.',
                ]}
              />
              <RailPanel
                title="What to watch"
                items={[
                  'Tool descriptions render verbatim. Read them as attacker-controlled text.',
                  <>A description can change between two <Box component="span" sx={mono}>tools/list</Box> calls.</>,
                  'A tool result is copied into the client as text. Read what came back, not only whether the call succeeded.',
                  'A second server can shadow a tool name you already trusted.',
                ]}
              />
              <RailPanel title="Allowlisted servers">
                {!servers.length && !serversError && (
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.82rem', mt: 0.5 }}>
                    Loading server list.
                  </Typography>
                )}
                <Box component="ul" sx={{ m: 0, mt: 0.5, pl: 2.25 }}>
                  {servers.map((server) => (
                    <Typography component="li" key={server.id} sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
                      {server.name}
                    </Typography>
                  ))}
                </Box>
              </RailPanel>
            </HubRail>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default McpHubPage;
