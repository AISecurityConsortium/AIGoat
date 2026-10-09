import React from 'react';
import { Alert, Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { EmptyState } from '../common';
import HubHero from '../common/HubHero';
import HubLabGroups from '../common/HubLabGroups';
import HubRail, { RailPanel } from '../common/HubRail';
import { mono } from '../common/panelStyles';
import { AGENT_FLOWS, AGENT_NAV_GROUPS, AGENT_ORDER, LEVEL_POSTURE, sortLabs } from '../../utils/labTeaching';

const AGENT_STEPS = [
  'Labs run as you, or as Admin where a lab needs staff tools. The planted-ticket lab starts as Alice.',
  'The exploit is the tool call the agent requests. Prose does not score.',
  `Level 0 is ${LEVEL_POSTURE[0]} Level 1 is ${LEVEL_POSTURE[1]} Level 2 is ${LEVEL_POSTURE[2]}`,
];

const AgentHubPage = () => {
  const runner = useLabs({ surface: 'agent.runner' });
  const host = useLabs({ surface: 'mcp.host' });
  const labs = sortLabs(
    [...runner.labs, ...host.labs.filter((lab) => String(lab.id).startsWith('asi') || lab.id === 'killchain-1')],
    AGENT_ORDER,
  );
  const loading = runner.loading || host.loading;
  const error = runner.error || host.error;
  const refetch = () => { runner.refetch(); host.refetch(); };
  const first = labs[0];

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: 2 }}>
      <Container maxWidth="xl">
        <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
          <HubHero
            eyebrow="Agentic security"
            title="Shop agent"
            description="The attack surface is the shop agent. You give it a goal and it may call a tool. That tool call is the exploit."
            steps={AGENT_STEPS}
            flow={AGENT_FLOWS.hub}
            note={first ? `First lab: ${first.name}` : ''}
            actions={(
              <>
                <Button
                  component={RouterLink}
                  to={first ? `/labs/${first.id}` : '/attacks?framework=owasp-agentic-2026'}
                  variant="contained"
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  {first ? 'Start with the refund' : 'Browse agentic labs'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => document.getElementById('agent-labs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Labs on this page
                </Button>
                <Button
                  component={RouterLink}
                  to="/admin/assistant"
                  variant="outlined"
                  size="small"
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Open the admin assistant
                </Button>
              </>
            )}
          />

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
            >
              Could not load agent labs. Confirm you are signed in and the API is running.
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
            <Box id="agent-labs" sx={{ minWidth: 0, scrollMarginTop: '72px', display: 'flex', flexDirection: 'column', gap: 2.5 }}>
              <Box>
                <Typography component="h2" sx={{ fontWeight: 700, mb: 0.5 }}>Four decisions and a capstone</Typography>
                <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
                  The labs stay in teaching order. A card that says "same note" is one attack seen again at another level.
                </Typography>
              </Box>

              {loading && !labs.length && (
                <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                  {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={140} />)}
                </Box>
              )}

              {!loading && !labs.length && !error && (
                <EmptyState title="No agent labs" description="The agent.runner surface has no labs yet." />
              )}

              <HubLabGroups groups={AGENT_NAV_GROUPS} labs={labs} />

              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                <Button
                  component={RouterLink}
                  to="/attacks?framework=owasp-agentic-2026"
                  variant="outlined"
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Agentic labs on Attack Labs
                </Button>
                <Button
                  component={RouterLink}
                  to="/threat-modeling"
                  variant="outlined"
                  size="small"
                  endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
                  sx={{ textTransform: 'none', fontWeight: 600 }}
                >
                  Threat modeling
                </Button>
              </Box>
            </Box>

            <HubRail label="Agent guidance">
              <RailPanel
                title="Try every defense level"
                lead="Re-run each lab at Level 0, Level 1, and Level 2. Note what still works. Defenses are not absolute."
                items={[
                  'Level 0 is the attack. The lab condition should be met.',
                  'Level 1 checks wording and the tool allowlist. A plain request in the right shape can still get through.',
                  'Level 2 adds approval, argument policy, and memory and result scanning. It still cannot judge a request an approver waves through.',
                ]}
              />
              <RailPanel
                title="What to watch"
                items={[
                  <>The transcript <Box component="span" sx={mono}>tool_call</Box> is the evidence, not model prose.</>,
                  <><Box component="span" sx={mono}>issue_refund</Box> and <Box component="span" sx={mono}>export_customer_data</Box> pause for approval at L2.</>,
                  'Standing notes are per user and per lab. At L0 they are trusted policy.',
                  <>Runs are bounded by <Box component="span" sx={mono}>max_steps</Box>.</>,
                ]}
              />
            </HubRail>
          </Box>
        </Box>
      </Container>
    </Box>
  );
};

export default AgentHubPage;
