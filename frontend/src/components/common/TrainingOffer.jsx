import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { useLocation } from 'react-router-dom';

const CONTACT_URL = 'https://www.linkedin.com/in/farooqmohammad/';

const ContactLink = ({ children }) => (
  <Box
    component="a"
    href={CONTACT_URL}
    target="_blank"
    rel="noopener noreferrer"
    sx={{
      color: 'primary.main',
      fontWeight: 600,
      textDecoration: 'none',
      '&:hover': { textDecoration: 'underline' },
    }}
  >
    {children}
  </Box>
);

ContactLink.propTypes = {
  children: PropTypes.node.isRequired,
};

const TrainingOffer = ({ variant = 'home' }) => {
  const location = useLocation();
  const signedIn = Boolean(location && localStorage.getItem('token'));
  if (!signedIn) return null;

  if (variant === 'footer') {
    return (
      <Typography sx={{ fontSize: '0.875rem', color: 'inherit', lineHeight: 1.5 }}>
        Looking for Closed Group Trainings?{' '}
        <ContactLink>Contact Us</ContactLink>
      </Typography>
    );
  }

  return (
    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', lineHeight: 1.55, mt: 1.25, maxWidth: 480 }}>
      Closed group training offers advanced guided labs, timed CTF challenges, user handouts, curated learning paths, and more.{' '}
      <ContactLink>Contact us</ContactLink>
    </Typography>
  );
};

TrainingOffer.propTypes = {
  variant: PropTypes.oneOf(['home', 'footer']),
};

export default TrainingOffer;
