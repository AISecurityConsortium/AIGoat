import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Container, Skeleton, Typography } from '@mui/material';
import { ArrowForward as ArrowForwardIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { useLabs } from '../../hooks/useLabs';
import { PageHeader, SectionCard, RiskChip, DifficultyChip, EmptyState } from '../common';

const oneLine = (text) => String(text || '').split('\n').map((line) => line.trim()).filter(Boolean)[0] || '';

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

const AgentHubPage = () => {
  const { labs, loading, error, refetch } = useLabs({ surface: 'agent.runner' });

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh', py: { xs: 3, md: 5 } }}>
      <Container maxWidth="md">
        <PageHeader
          title="Shop agent"
          subtitle="The planner's output is untrusted. The Intent Gate decides what actually runs."
        />

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
          <SectionCard title="How a run moves">
            <Box
              component="img"
              src="/media/diagrams/agent-loop.svg"
              alt="Goal to planner to Intent Gate to tool to observation. L1 tool.allowlist sits on the gate. L2 tool.approval and memory.scan sit on refund and memory paths."
              sx={{ width: '100%', maxWidth: 720, display: 'block', mx: 'auto' }}
            />
            <Typography sx={{ color: 'text.secondary', fontSize: '0.78rem', mt: 1.5, textAlign: 'center' }}>
              L1 pins unknown tools with tool.allowlist. L2 pauses refunds and exports on tool.approval and drops planted notes with memory.scan.
            </Typography>
          </SectionCard>
        </Box>

        <Box sx={{ mb: 3 }}>
          <SectionCard title="What to watch">
            <Box component="ul" sx={{ m: 0, pl: 2.5, color: (t) => t.palette.custom?.text?.body ?? 'text.primary' }}>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 0.75 }}>
                The transcript <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>tool_call</Box> is the evidence, not model prose.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 0.75 }}>
                <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>issue_refund</Box> and <Box component="span" sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' }}>export_customer_data</Box> pause for approval at L2.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6, mb: 0.75 }}>
                Standing notes are per user and per lab. At L0 they are trusted policy.
              </Typography>
              <Typography component="li" sx={{ fontSize: '0.85rem', lineHeight: 1.6 }}>
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

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 4 }}>
          {labs.map((lab) => <HubLabCard key={lab.id} lab={lab} />)}
        </Box>

        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button
            component={RouterLink}
            to="/attacks?framework=owasp-agentic-2026"
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardIcon sx={{ fontSize: '0.75rem !important' }} />}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Agentic labs on Attack Labs
          </Button>
          <Button
            component={RouterLink}
            to="/threat-modeling"
            variant="outlined"
            size="small"
            endIcon={<ArrowForwardIcon sx={{ fontSize: '0.75rem !important' }} />}
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
