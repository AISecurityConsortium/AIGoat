import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/**
 * Collapsible inset in the style of the MCP guide, hint, and defense-behaviour
 * disclosures. Keyboard operable; `aria-expanded` reflects the state.
 */
const Disclosure = ({
  title, meta = '', defaultOpen = false, children = null, sx = undefined,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => setOpen((value) => !value);
  return (
    <Box
      sx={{
        borderRadius: '8px',
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.18 : 0.02),
        overflow: 'hidden',
        ...sx,
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={toggle}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            toggle();
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.75,
          cursor: 'pointer',
          '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
        }}
      >
        <ChevronRightIcon sx={{ fontSize: '1.1rem', color: 'text.secondary', transform: open ? 'rotate(90deg)' : 'none' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{title}</Typography>
        {meta && <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>{meta}</Typography>}
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.25, pb: 1.25 }}>{children}</Box>
      </Collapse>
    </Box>
  );
};

Disclosure.propTypes = {
  title: PropTypes.string.isRequired,
  meta: PropTypes.string,
  defaultOpen: PropTypes.bool,
  children: PropTypes.node,
  sx: PropTypes.object, // eslint-disable-line react/forbid-prop-types
};

export default Disclosure;
