import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Typography } from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
import { useDefense } from '../../contexts/DefenseContext';
import { apiClient } from '../../config/api';
import DefenseLevelChip from './DefenseLevelChip';
import SectionCard from './SectionCard';
import { HOST_STEPS } from '../../utils/labTeaching';

const DIAGRAM = {
  'agent.runner': {
    src: '/media/diagrams/agent-loop.svg',
    alt: 'Goal to planner to Intent Gate to tool to observation.',
  },
  'mcp.client': {
    src: '/media/diagrams/mcp-stateless-call.svg',
    alt: 'One action spawns a stdio server, runs one RPC, and reaps it.',
  },
};

const WATCH = {
  'agent.runner': 'The transcript tool_call is the evidence, not model prose.',
  'mcp.client': 'Read the tool description as untrusted text.',
  'mcp.host': 'The score is the tool the assistant calls, not the sentence it writes.',
};

const expectedAt = (expected, level) => {
  if (!expected || typeof expected !== 'object') return '';
  return expected[String(level)] || expected[level] || '';
};

const switchPersona = async (alicePath) => {
  const current = localStorage.getItem('username');
  const target = current === 'admin' ? 'alice' : 'admin';
  if (current !== 'alice' && current !== 'admin') return;
  const res = await apiClient.get('/api/auth/demo-users/');
  const match = (res.data.users || []).find((row) => row.username === target);
  if (!match?.demo_token) return;
  localStorage.setItem('token', match.demo_token);
  localStorage.setItem('username', target);
  window.location.assign(target === 'admin' ? '/admin/assistant' : alicePath);
};

const LabPrimer = ({ lab, onTryPayload }) => {
  const { defenseLevel } = useDefense();
  if (!lab) return null;

  const diagram = DIAGRAM[lab.surface];
  const payloads = (lab.example_payloads || []).map((item) => String(item).trim()).filter(Boolean);
  const expected = expectedAt(lab.expected_by_level, defenseLevel);
  const watch = WATCH[lab.surface];
  const canFill = typeof onTryPayload === 'function';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mb: 2 }}>
      {lab.description && (
        <SectionCard title="Goal" dense>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6 }}>
            {lab.description}
          </Typography>
        </SectionCard>
      )}

      {diagram && (
        <SectionCard dense>
          <Box
            component="img"
            src={diagram.src}
            alt={diagram.alt}
            sx={{ width: '100%', maxWidth: 560, display: 'block', mx: 'auto' }}
          />
        </SectionCard>
      )}

      {lab.surface === 'mcp.host' && (
        <SectionCard title="Two steps" dense>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, mb: 1 }}>
            {(HOST_STEPS[lab.id] || {}).step1 || 'Step 1 is described in the objective below.'}
          </Typography>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, mb: 1.5 }}>
            {(HOST_STEPS[lab.id] || {}).step2 || 'Step 2 as Admin: open the assistant. The tool call is the result.'}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {(HOST_STEPS[lab.id] || {}).plant && (
              <Button
                variant="outlined"
                onClick={() => switchPersona((HOST_STEPS[lab.id] || {}).plant === 'review' ? '/home' : '/support')}
                sx={{ textTransform: 'none' }}
              >
                Switch persona
              </Button>
            )}
            <Button component={RouterLink} to={`/admin/assistant?lab=${lab.id}`} variant="contained" sx={{ textTransform: 'none' }}>
              Open assistant
            </Button>
          </Box>
        </SectionCard>
      )}

      {payloads.length > 0 && (
        <SectionCard title="Show me" dense>
          <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
            {payloads.map((text) => (
              <Box component="li" key={text} sx={{ mb: 1 }}>
                {canFill ? (
                  <Button
                    onClick={() => onTryPayload(text)}
                    sx={{
                      textTransform: 'none',
                      textAlign: 'left',
                      display: 'block',
                      whiteSpace: 'pre-wrap',
                      fontWeight: 500,
                      fontSize: '0.9375rem',
                      lineHeight: 1.5,
                      px: 0,
                    }}
                  >
                    {text}
                  </Button>
                ) : (
                  <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {text}
                  </Typography>
                )}
              </Box>
            ))}
          </Box>
          {canFill && (
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
              Click a step to put it in the Goal box.
            </Typography>
          )}
        </SectionCard>
      )}

      {lab.objective && (
        <SectionCard title="How this attack works" dense>
          <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, whiteSpace: 'pre-line' }}>
            {lab.objective}
          </Typography>
        </SectionCard>
      )}

      {expected && (
        <SectionCard title="What to expect at this defense level" dense>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: 1 }}>
            <DefenseLevelChip level={defenseLevel} />
          </Box>
          <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.6 }}>
            {expected}
          </Typography>
        </SectionCard>
      )}

      {watch && (
        <Typography sx={{ fontSize: '0.9375rem', color: 'text.secondary', lineHeight: 1.5 }}>
          {watch}
        </Typography>
      )}
    </Box>
  );
};

LabPrimer.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string,
    surface: PropTypes.string,
    description: PropTypes.string,
    objective: PropTypes.string,
    example_payloads: PropTypes.arrayOf(PropTypes.string),
    expected_by_level: PropTypes.objectOf(PropTypes.string),
  }),
  onTryPayload: PropTypes.func,
};

LabPrimer.defaultProps = {
  lab: null,
  onTryPayload: undefined,
};

export default LabPrimer;
