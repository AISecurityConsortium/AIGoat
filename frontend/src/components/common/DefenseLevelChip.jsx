import React from 'react';
import PropTypes from 'prop-types';
import { Chip, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';

/**
 * @typedef DefenseLevelChipProps
 * @property {0|1|2} level
 * @property {boolean} [showFullLabel]
 * @property {string} [color] API-provided hex colour; falls back to the theme map
 */

const COLOR_KEYS = { 0: 'error.main', 1: 'warning.light', 2: 'secondary.main' };
export const DEFENSE_LEVEL_LABELS = {
  0: 'L0 — Vulnerable',
  1: 'L1 — Hardened',
  2: 'L2 — Guardrailed',
};

const getThemeColor = (theme, path) => {
  const parts = path.split('.');
  let val = theme.palette;
  for (const p of parts) val = val?.[p];
  return val;
};

const DefenseLevelChip = ({ level, showFullLabel = false, color }) => {
  const theme = useTheme();
  const numeric = Number(level);
  const levelColor = color || getThemeColor(theme, COLOR_KEYS[numeric] || COLOR_KEYS[0]);
  const full = DEFENSE_LEVEL_LABELS[numeric] || `L${level}`;
  const label = showFullLabel ? full : `L${numeric}`;
  const chip = (
    <Chip
      label={label}
      size="small"
      sx={{
        bgcolor: levelColor ? `${levelColor}18` : 'primary.main',
        color: levelColor ?? 'primary.main',
        fontWeight: 700,
        fontSize: '0.68rem',
        minWidth: 32,
        border: levelColor ? `1px solid ${levelColor}30` : (t) => `1px solid ${t.palette.primary.main}4D`,
      }}
    />
  );
  if (showFullLabel) return chip;
  return <Tooltip title={full}>{chip}</Tooltip>;
};

DefenseLevelChip.propTypes = {
  level: PropTypes.oneOf([0, 1, 2, '0', '1', '2']).isRequired,
  showFullLabel: PropTypes.bool,
  color: PropTypes.string,
};

export default DefenseLevelChip;
