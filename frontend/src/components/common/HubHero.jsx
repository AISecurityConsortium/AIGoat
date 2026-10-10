import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import McpFlow from './McpFlow';

/**
 * Hero shared by the MCP, Agentic, and RAG landing pages: eyebrow, title, description,
 * numbered steps, actions, and a flow diagram on the right.
 */
const HubHero = ({
  eyebrow, title, description, steps = [], actions = null, note = '', flow = null, aside = null,
}) => (
  <Box
    sx={{
      mb: 2,
      p: { xs: 2.5, md: 3 },
      borderRadius: '16px',
      border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
      background: (t) => (t.palette.mode === 'dark'
        ? 'linear-gradient(145deg, rgba(99,102,241,0.16) 0%, rgba(18,18,30,0.4) 55%)'
        : 'linear-gradient(145deg, rgba(79,70,229,0.08) 0%, rgba(255,255,255,0.65) 58%)'),
    }}
  >
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: (flow || aside) ? '1.05fr 0.95fr' : '1fr' }, gap: { xs: 2.5, md: 3 }, alignItems: 'center' }}>
      <Box>
        <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'primary.main', mb: 1 }}>
          {eyebrow}
        </Typography>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '1.7rem', md: '2.15rem' }, mb: 1 }}>
          {title}
        </Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '1rem', lineHeight: 1.65, mb: 2 }}>
          {description}
        </Typography>
        {steps.length > 0 && (
          <Box component="ol" sx={{ listStyle: 'none', m: 0, p: 0, display: 'flex', flexDirection: 'column', gap: 1, mb: 2.5 }}>
            {steps.map((step, index) => (
              <Box component="li" key={step} sx={{ display: 'flex', gap: 1.25, alignItems: 'flex-start' }}>
                <Box
                  aria-hidden="true"
                  sx={{
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
        )}
        {actions && <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>{actions}</Box>}
        {note && (
          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mt: 1.25 }}>{note}</Typography>
        )}
      </Box>
      {flow && (
        <Box sx={{ width: '100%', maxWidth: 380, mx: 'auto' }}>
          <McpFlow steps={flow.steps} caption={flow.caption} stacked />
        </Box>
      )}
      {!flow && aside && <Box sx={{ minWidth: 0 }}>{aside}</Box>}
    </Box>
  </Box>
);

HubHero.propTypes = {
  eyebrow: PropTypes.string.isRequired,
  title: PropTypes.string.isRequired,
  description: PropTypes.string.isRequired,
  steps: PropTypes.arrayOf(PropTypes.string),
  actions: PropTypes.node,
  note: PropTypes.string,
  aside: PropTypes.node,
  flow: PropTypes.shape({
    steps: PropTypes.arrayOf(PropTypes.object).isRequired,
    caption: PropTypes.string,
  }),
};

export default HubHero;
