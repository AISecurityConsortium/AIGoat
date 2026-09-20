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
 * @property {React.ReactNode} children
 */

const TONE_PALETTE = {
  info: 'info',
  warning: 'warning',
  success: 'success',
};

const SectionCard = ({ title, icon, tone = 'default', dense = false, children }) => {
  const tintKey = TONE_PALETTE[tone];

  return (
    <Paper
      elevation={0}
      sx={{
        p: dense ? 2 : { xs: 2.5, md: 3 },
        borderRadius: '14px',
        bgcolor: (t) =>
          tintKey
            ? alpha(t.palette[tintKey].main, 0.06)
            : (t.palette.custom?.surface?.elevated ?? 'background.paper'),
        border: (t) =>
          tintKey
            ? `1px solid ${alpha(t.palette[tintKey].main, 0.2)}`
            : `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
      }}
    >
      {(title || icon) && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          {icon}
          {title && (
            <Typography sx={{ fontWeight: 700, fontSize: '1rem', color: 'text.primary', letterSpacing: '-0.01em' }}>
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
  children: PropTypes.node.isRequired,
};

export default SectionCard;
