import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography, useMediaQuery } from '@mui/material';

/**
 * @typedef PageHeaderProps
 * @property {React.ReactNode} [icon]
 * @property {string} title
 * @property {string} [subtitle]
 * @property {React.ReactNode} [actions]
 * @property {number} [maxSubtitleWidth]
 */

const PageHeader = ({ icon, title, subtitle, actions, maxSubtitleWidth = 560 }) => {
  const isMobile = useMediaQuery('(max-width:900px)');

  return (
    <Box
      sx={{
        mb: 4,
        display: 'flex',
        flexDirection: { xs: 'column', md: 'row' },
        alignItems: { xs: 'flex-start', md: 'flex-start' },
        justifyContent: 'space-between',
        gap: 2,
      }}
    >
      <Box sx={{ minWidth: 0, flex: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: subtitle ? 1 : 0 }}>
          {icon}
          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 800,
              color: 'text.primary',
              letterSpacing: '-0.03em',
              fontSize: isMobile ? '1.7rem' : '2.3rem',
            }}
          >
            {title}
          </Typography>
        </Box>
        {subtitle && (
          <Typography
            variant="body1"
            sx={{
              color: 'text.secondary',
              maxWidth: maxSubtitleWidth,
              lineHeight: 1.7,
              fontSize: '0.9rem',
            }}
          >
            {subtitle}
          </Typography>
        )}
      </Box>
      {actions && (
        <Box
          sx={{
            display: 'flex',
            gap: 1,
            flexWrap: 'wrap',
            flexShrink: 0,
            width: isMobile ? '100%' : 'auto',
          }}
        >
          {actions}
        </Box>
      )}
    </Box>
  );
};

PageHeader.propTypes = {
  icon: PropTypes.node,
  title: PropTypes.string.isRequired,
  subtitle: PropTypes.string,
  actions: PropTypes.node,
  maxSubtitleWidth: PropTypes.number,
};

export default PageHeader;
