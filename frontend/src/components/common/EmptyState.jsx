import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';

/**
 * @typedef EmptyStateProps
 * @property {React.ReactNode} [icon]
 * @property {string} title
 * @property {string} [description]
 * @property {React.ReactNode} [action]
 */

const EmptyState = ({ icon, title, description, action }) => (
  <Box
    role="status"
    sx={{
      textAlign: 'center',
      py: 8,
      px: 2,
      borderRadius: '12px',
      bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
      border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
    }}
  >
    {icon && (
      <Box sx={{ mb: 2, color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}>
        {icon}
      </Box>
    )}
    <Typography variant="h6" sx={{ color: 'text.primary', mb: 1 }}>
      {title}
    </Typography>
    {description && (
      <Typography sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary', mb: action ? 2 : 0 }}>
        {description}
      </Typography>
    )}
    {action}
  </Box>
);

EmptyState.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  description: PropTypes.string,
  action: PropTypes.node,
};

export default EmptyState;
