import React from 'react';
import PropTypes from 'prop-types';
import { Box, Button, Typography } from '@mui/material';
import { useDefense } from '../../contexts/DefenseContext';
import DefenseLevelChip from './DefenseLevelChip';
import SectionCard from './SectionCard';

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
};

const expectedAt = (expected, level) => {
  if (!expected || typeof expected !== 'object') return '';
  return expected[String(level)] || expected[level] || '';
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
