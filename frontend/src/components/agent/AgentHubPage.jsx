import React from 'react';
import { Alert, Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { SectionCard, EmptyState } from '../common';
import HubLabCard from '../common/HubLabCard';
import { AGENT_ORDER, sortLabs } from '../../utils/labTeaching';

const AGENT_STEPS = [
  'The attack surface is the agent runner, and for Admin the same assistant.',
  'The exploit is the accepted tool call. Prose does not score.',
  'Level 0 runs the call. Level 1 checks the allowlist. Level 2 also asks you to approve refunds and exports, and scans memory.',
];

const AgentHubPage = () => {
  const runner = useLabs({ surface: 'agent.runner' });
  const host = useLabs({ surface: 'mcp.host' });
  const labs = sortLabs(
    [...runner.labs, ...host.labs.filter((lab) => String(lab.id).startsWith('asi'))],
    AGENT_ORDER,
  );
  const loading = runner.loading || host.loading;
  const error = runner.error || host.error;
  const refetch = () => { runner.refetch(); host.refetch(); };
  const first = labs[0];

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
                Agentic security
              </Typography>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '1.7rem', md: '2.15rem' }, mb: 1 }}>
                Shop agent
              </Typography>
              <Typography sx={{ color: 'text.secondary', fontSize: '1rem', lineHeight: 1.65, mb: 2 }}>
                The attack surface is the shop agent. You give it a goal. It may call a tool. That tool call is the exploit. Attacker and victim labs start as Alice, who plants a ticket or review, then switch to Admin so the assistant acts on it.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
                {AGENT_STEPS.map((step, index) => (
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
                src="/media/diagrams/agent-loop.svg"
                alt="Goal to planner to Intent Gate to tool to observation."
                sx={{ width: '100%', display: 'block' }}
              />
              <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mt: 1, lineHeight: 1.5 }}>
                L1 pins unknown tools with tool.allowlist. L2 pauses refunds and exports, and drops planted notes with memory.scan.
              </Typography>
            </Box>
          </Box>
        </Box>

        {error && (
          <Alert
            severity="error"
            sx={{ mb: 3 }}
            action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
          >
            Could not load agent labs. Confirm you are signed in and the API is running.
          </Alert>
        )}

        <Box sx={{ mb: 3 }}>
          <SectionCard title="What to watch">
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                The transcript <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>tool_call</Box> is the evidence, not model prose.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>issue_refund</Box> and <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>export_customer_data</Box> pause for approval at L2.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6, mb: 0.75 }}>
                Standing notes are per user and per lab. At L0 they are trusted policy.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
                Runs are bounded by <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>max_steps</Box>.
              </Typography>
            </Box>
          </SectionCard>
        </Box>

        {loading && !labs.length && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3 }}>
            {[0, 1, 2].map((i) => <Skeleton key={i} variant="rounded" height={96} />)}
          </Box>
        )}

        {!loading && !labs.length && !error && (
          <EmptyState title="No agent labs" description="The agent.runner surface has no labs yet." />
        )}

        <Box id="agent-labs" sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Do these in order</Typography>
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 0.5 }}>
            A card that says "same idea" or "same note" is one attack seen again. ASI01 is the review version of the planted-ticket labs.
          </Typography>
          {labs.map((lab, index) => <HubLabCard key={lab.id} lab={lab} index={index + 1} />)}
        </Box>

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
      </Container>
    </Box>
  );
};

export default AgentHubPage;
