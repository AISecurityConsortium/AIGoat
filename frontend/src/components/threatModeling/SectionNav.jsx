import React from 'react';
import PropTypes from 'prop-types';
import { Box, Link } from '@mui/material';

/**
 * Sticky in-page navigation. Plain anchors so it works without JavaScript
 * routing; the click handler only adds smooth scrolling and moves focus.
 */
const SectionNav = ({ sections }) => {
  const go = (event, id) => {
    const el = document.getElementById(id);
    if (!el) return;
    event.preventDefault();
    if (typeof el.scrollIntoView === 'function') el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (typeof window.history?.replaceState === 'function') window.history.replaceState(null, '', `#${id}`);
  };
  return (
    <Box
      component="nav"
      aria-label="On this page"
      data-testid="section-nav"
      sx={{
        position: 'sticky',
        top: 57,
        zIndex: 5,
        mb: 3,
        py: 1,
        display: 'flex',
        gap: 0.75,
        overflowX: 'auto',
        bgcolor: 'background.default',
        borderBottom: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
      }}
    >
      {sections.map((s) => (
        <Link
          key={s.id}
          href={`#${s.id}`}
          onClick={(e) => go(e, s.id)}
          underline="none"
          data-testid={`nav-${s.id}`}
          sx={{
            flexShrink: 0,
            px: 1.5,
            py: 0.5,
            borderRadius: '999px',
            fontSize: '0.8125rem',
            fontWeight: 600,
            color: 'text.secondary',
            border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
            '&:hover': { color: 'text.primary', borderColor: 'primary.main' },
            '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
          }}
        >
          {s.label}
        </Link>
      ))}
    </Box>
  );
};

SectionNav.propTypes = {
  sections: PropTypes.arrayOf(PropTypes.shape({ id: PropTypes.string.isRequired, label: PropTypes.string.isRequired })).isRequired,
};

export default SectionNav;
