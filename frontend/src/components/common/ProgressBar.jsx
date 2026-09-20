import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, LinearProgress } from '@mui/material';
import { alpha } from '@mui/material/styles';

/**
 * @typedef ProgressBarProps
 * @property {number} value
 * @property {number} total
 * @property {string} [label]
 * @property {boolean} [showChip]
 */

const ProgressBar = ({ value, total, label, showChip = true }) => {
  const safeTotal = total > 0 ? total : 0;
  const pct = safeTotal > 0 ? (value / safeTotal) * 100 : 0;
  const complete = safeTotal > 0 && value >= safeTotal;
  const chipLabel = label || `${value}/${total} completed`;

  return (
    <Box>
      {showChip && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 1 }}>
          <Chip
            label={chipLabel}
            size="small"
            sx={{
              bgcolor: complete
                ? (t) => alpha(t.palette.secondary.main, 0.15)
                : (t) => t.palette.custom?.overlay?.hover ?? alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.06),
              color: complete ? 'secondary.main' : 'text.secondary',
              fontWeight: 600,
              fontSize: '0.75rem',
              border: complete
                ? (t) => `1px solid ${alpha(t.palette.secondary.main, 0.3)}`
                : (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
            }}
          />
        </Box>
      )}
      <LinearProgress
        variant="determinate"
        value={pct}
        aria-valuenow={value}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={chipLabel}
        sx={{
          mb: 4,
          height: 4,
          borderRadius: 2,
          bgcolor: (t) => t.palette.custom?.overlay?.hover ?? alpha(t.palette.mode === 'dark' ? t.palette.common.white : t.palette.common.black, 0.06),
          '& .MuiLinearProgress-bar': {
            bgcolor: complete ? 'secondary.main' : 'primary.main',
            borderRadius: 2,
          },
        }}
      />
    </Box>
  );
};

ProgressBar.propTypes = {
  value: PropTypes.number.isRequired,
  total: PropTypes.number.isRequired,
  label: PropTypes.string,
  showChip: PropTypes.bool,
};

export default ProgressBar;
