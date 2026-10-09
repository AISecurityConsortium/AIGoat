import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

const McpFlow = ({ steps, caption = '', stacked = false, compact = false }) => {
  const label = [
    ...steps.map((step) => `${step.title}: ${step.detail}`),
    caption,
  ].filter(Boolean).join('. ');

  return (
    <Box role="img" aria-label={label}>
      <Box
        sx={{
          display: 'flex',
          flexDirection: stacked ? 'column' : 'row',
          flexWrap: stacked ? 'nowrap' : 'wrap',
          alignItems: stacked ? 'stretch' : 'center',
          justifyContent: 'center',
          gap: compact ? 0.35 : 0.75,
        }}
      >
        {steps.map((step, index) => (
          <React.Fragment key={`${step.title}-${step.detail}`}>
            {index > 0 && (
              <Typography aria-hidden="true" sx={{ color: 'text.secondary', fontWeight: 700, textAlign: 'center' }}>
                {stacked ? '↓' : '→'}
              </Typography>
            )}
            <Box
              sx={{
                flex: stacked ? '0 0 auto' : `1 1 ${compact ? 88 : 140}px`,
                maxWidth: stacked ? 'none' : (compact ? 120 : 200),
                width: stacked ? '100%' : undefined,
                px: compact ? 0.75 : 1.25,
                py: compact ? 0.35 : 1,
                borderRadius: '8px',
                border: '1.5px solid',
                borderColor: (theme) => {
                  if (step.warn) return theme.palette.warning.main;
                  if (step.accent) return theme.palette.primary.main;
                  return theme.palette.divider;
                },
              }}
            >
              <Typography sx={{ fontWeight: 700, fontSize: compact ? '0.75rem' : '0.875rem', textAlign: 'center', lineHeight: 1.25 }}>
                {step.title}
              </Typography>
              <Typography sx={{ fontSize: compact ? '0.6875rem' : '0.8125rem', textAlign: 'center', color: 'text.secondary', lineHeight: 1.3, mt: 0.15 }}>
                {step.detail}
              </Typography>
            </Box>
          </React.Fragment>
        ))}
      </Box>
      {caption && (
        <Typography sx={{ mt: compact ? 0.75 : 1.5, textAlign: 'center', fontSize: compact ? '0.75rem' : '0.9375rem', color: 'text.secondary', lineHeight: 1.35 }}>
          {caption}
        </Typography>
      )}
    </Box>
  );
};

McpFlow.propTypes = {
  steps: PropTypes.arrayOf(PropTypes.shape({
    title: PropTypes.string.isRequired,
    detail: PropTypes.string.isRequired,
    warn: PropTypes.bool,
    accent: PropTypes.bool,
  })).isRequired,
  caption: PropTypes.string,
  stacked: PropTypes.bool,
  compact: PropTypes.bool,
};

export default McpFlow;
