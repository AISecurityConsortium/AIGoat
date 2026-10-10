import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import HubLabCard from './HubLabCard';

/**
 * Labs grouped by decision, two cards across on wide screens. Each group is
 * `{ id, title, detail, labs: [labId] }`; ids with no loaded lab are skipped.
 */
const HubLabGroups = ({ groups, labs }) => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
    {groups.map((group) => {
      const members = group.labs
        .map((id) => labs.find((lab) => lab.id === id))
        .filter(Boolean);
      if (!members.length) return null;
      return (
        <Box key={group.id} component="section" aria-label={group.title} sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
          <Box>
            <Typography component="h3" sx={{ fontWeight: 700 }}>{group.title}</Typography>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>{group.detail}</Typography>
          </Box>
          <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, alignItems: 'stretch' }}>
            {members.map((lab, index) => (
              <HubLabCard key={lab.id} lab={lab} index={index + 1} />
            ))}
          </Box>
        </Box>
      );
    })}
  </Box>
);

HubLabGroups.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    title: PropTypes.string.isRequired,
    detail: PropTypes.string,
    labs: PropTypes.arrayOf(PropTypes.string).isRequired,
  })).isRequired,
  labs: PropTypes.arrayOf(PropTypes.object).isRequired, // eslint-disable-line react/forbid-prop-types
};

export default HubLabGroups;
