import React, { useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Collapse, Typography } from '@mui/material';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { HintLadder } from '../labs/LabGuide';

const McpHintDisclosure = ({ labId }) => {
  const [open, setOpen] = useState(false);
  const toggle = () => setOpen((value) => !value);
  return (
    <Box sx={{ mt: 1, borderRadius: '8px', border: (t) => `1px solid ${t.palette.divider}` }}>
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
        sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1.25, py: 0.75, cursor: 'pointer' }}
      >
        <ChevronRightIcon sx={{ fontSize: '1.1rem', color: 'text.secondary', transform: open ? 'rotate(90deg)' : 'none' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Need a nudge?</Typography>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.25, pb: 1.25 }}>
          {open && <HintLadder labId={labId} />}
        </Box>
      </Collapse>
    </Box>
  );
};

McpHintDisclosure.propTypes = { labId: PropTypes.string.isRequired };

export default McpHintDisclosure;
