import React from 'react';
import PropTypes from 'prop-types';
import { Chip, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * @typedef RiskChipProps
 * @property {string} code
 * @property {string} [framework]
 * @property {'small'|'medium'} [size]
 * @property {function} [onClick]
 */

const RiskChip = ({ code, framework, size = 'small', onClick }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === 'dark';
  const chip = (
    <Chip
      label={code}
      size={size}
      clickable={Boolean(onClick)}
      onClick={onClick}
      sx={{
        bgcolor: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        color: isDark ? '#c8d0db' : '#475569',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)'}`,
        fontWeight: 700,
        fontSize: '0.7rem',
        minWidth: 56,
        height: 24,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        cursor: onClick ? 'pointer' : 'default',
        '&:focus-visible': {
          outline: '2px solid',
          outlineColor: 'primary.main',
          outlineOffset: 2,
        },
      }}
    />
  );

  if (framework) {
    return <Tooltip title={framework}>{chip}</Tooltip>;
  }
  return chip;
};

RiskChip.propTypes = {
  code: PropTypes.string.isRequired,
  framework: PropTypes.string,
  size: PropTypes.oneOf(['small', 'medium']),
  onClick: PropTypes.func,
};

export default RiskChip;
