import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { SectionCard, RiskChip, DifficultyChip, EmptyState } from '../common';

const oneLine = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';

const HubLabCard = ({ lab }) => {
  const code = (lab.primary_risk || '').includes(':')
    ? lab.primary_risk.split(':').slice(1).join(':')
    : (lab.owasp || '');
  return (
    <SectionCard dense>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.75 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '1rem' }}>{lab.name}</Typography>
        {code && <RiskChip code={code} />}
        {lab.difficulty && <DifficultyChip difficulty={lab.difficulty} />}
      </Box>
      <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', lineHeight: 1.5, mb: 1.5 }}>
        {oneLine(lab.objective) || lab.description}
      </Typography>
      <Button
        component={RouterLink}
        to={`/labs/${lab.id}`}
        size="small"
        variant="outlined"
        endIcon={<ArrowForwardIcon sx={{ fontSize: '0.9375rem !important' }} />}
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

const AGENT_STEPS = [
  'See how a run moves. The Intent Gate decides what actually runs.',
  'Open a console and give the agent a goal.',
  'Read the transcript. The tool_call is what happened.',
];

const AgentHubPage = () => {
  const { labs, loading, error, refetch } = useLabs({ surface: 'agent.runner' });
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
                Make the shop agent do something it should refuse. The planner can say anything. The tool call is what happened.
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
                  {first ? 'Open the first lab' : 'Browse agentic labs'}
                </Button>
                <Button
                  variant="outlined"
                  size="small"
                  onClick={() => document.getElementById('agent-labs')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
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
          {labs.map((lab) => <HubLabCard key={lab.id} lab={lab} />)}
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
