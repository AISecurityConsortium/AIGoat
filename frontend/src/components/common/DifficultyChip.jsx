import React from 'react';
import PropTypes from 'prop-types';
import { Chip } from '@mui/material';

/**
 * @typedef DifficultyChipProps
 * @property {'beginner'|'intermediate'|'advanced'|'expert'} difficulty
 */

export const DIFF = {
  beginner: { label: 'Beginner', order: 0, hue: 'secondary' },
  intermediate: { label: 'Intermediate', order: 1, hue: 'warning' },
  advanced: { label: 'Advanced', order: 2, hue: 'warning' },
  expert: { label: 'Expert', order: 3, hue: 'error' },
};

const DifficultyChip = ({ difficulty }) => {
  const meta = DIFF[difficulty] || DIFF.beginner;
  return <Chip color={meta.hue} size="small" label={meta.label} />;
};

DifficultyChip.propTypes = {
  difficulty: PropTypes.oneOf(['beginner', 'intermediate', 'advanced', 'expert']).isRequired,
};

export default DifficultyChip;
