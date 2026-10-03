import React from 'react';
import PropTypes from 'prop-types';
import { Box, Paper, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';

/**
 * @typedef SectionCardProps
 * @property {string} [title]
 * @property {React.ReactNode} [icon]
 * @property {'default'|'info'|'warning'|'success'} [tone]
 * @property {boolean} [dense]
 * @property {boolean} [compact]
 * @property {React.ReactNode} children
 */

const TONE_PALETTE = {
  info: 'info',
  warning: 'warning',
  success: 'success',
};

const SectionCard = ({ title, icon, tone = 'default', dense = false, compact = false, fill = false, stretch = false, children }) => {
  const tintKey = TONE_PALETTE[tone];

  return (
    <Paper
      elevation={0}
      sx={{
        p: compact ? 1.25 : dense ? 2 : { xs: 2.5, md: 3 },
        borderRadius: '14px',
        bgcolor: (t) =>
          tintKey
            ? alpha(t.palette[tintKey].main, 0.06)
            : (t.palette.custom?.surface?.elevated ?? 'background.paper'),
        border: (t) =>
          tintKey
            ? `1px solid ${alpha(t.palette[tintKey].main, 0.2)}`
            : `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
        ...(fill ? { flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } : {}),
        ...(stretch ? { flex: 1, width: '100%', display: 'flex', flexDirection: 'column' } : {}),
      }}
    >
      {(title || icon) && (
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mb: compact ? 0.75 : 2 }}>
          {icon}
          {title && (
            <Typography sx={{ fontWeight: 700, fontSize: compact ? '0.875rem' : '1rem', lineHeight: 1.3, color: 'text.primary', letterSpacing: '-0.01em' }}>
              {title}
            </Typography>
          )}
        </Box>
      )}
      {children}
    </Paper>
  );
};

SectionCard.propTypes = {
  title: PropTypes.string,
  icon: PropTypes.node,
  tone: PropTypes.oneOf(['default', 'info', 'warning', 'success']),
  dense: PropTypes.bool,
  compact: PropTypes.bool,
  fill: PropTypes.bool,
  stretch: PropTypes.bool,
  children: PropTypes.node.isRequired,
};

export default SectionCard;
