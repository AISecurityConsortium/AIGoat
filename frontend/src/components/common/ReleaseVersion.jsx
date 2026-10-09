import React from 'react';
import PropTypes from 'prop-types';
import { Typography } from '@mui/material';
import { RELEASE_VERSION, releaseLabel } from '../../config/release';

const ReleaseVersion = ({ sx }) => (
  <Typography
    component="span"
    data-testid="release-version"
    aria-label={`Release ${RELEASE_VERSION}`}
    sx={{
      fontSize: '0.65rem',
      fontWeight: 600,
      letterSpacing: '0.04em',
      color: 'text.secondary',
      lineHeight: 1,
      whiteSpace: 'nowrap',
      flexShrink: 0,
      ...sx,
    }}
  >
    {releaseLabel()}
  </Typography>
);

ReleaseVersion.propTypes = {
  sx: PropTypes.object, // eslint-disable-line react/forbid-prop-types
};

export default ReleaseVersion;
