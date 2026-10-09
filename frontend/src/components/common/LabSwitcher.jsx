import React from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { CheckCircleOutline as CheckIcon } from '@mui/icons-material';

/**
 * Lab switcher shared by the MCP and Agentic tracks: one chip per lab, grouped by
 * decision, with a tick on labs the learner has completed. Navigation is never blocked.
 */
const NO_NAMES = {};
const NO_COMPLETED = new Set();
const plainLabel = (id) => id;
const labHref = (id) => (id === 'killchain-1' ? '/challenges?killchain=1' : `/labs/${id}`);

const LabSwitcher = ({
  groups, ariaLabel, currentId, labNames = NO_NAMES, completedIds = NO_COMPLETED, labelFor = plainLabel, hrefFor = labHref,
}) => (
  <Box component="nav" aria-label={ariaLabel} sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 1.5, rowGap: 0.5, alignItems: 'center', minWidth: 0, flex: { xs: '1 1 100%', sm: '1 1 0' } }}>
    {groups.map((group) => (
      <Box key={group.id} role="group" aria-label={group.label} sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, minWidth: 0 }}>
        <Typography sx={{ fontSize: '0.62rem', color: 'text.secondary', textTransform: 'uppercase', letterSpacing: '0.04em', mr: 0.25, whiteSpace: 'nowrap' }}>
          {group.label}
        </Typography>
        {group.labs.map((id, index) => {
          const current = id === currentId;
          const step = group.steps?.[id];
          return (
            <React.Fragment key={id}>
              {group.series && index > 0 && (
                <Typography aria-hidden="true" sx={{ fontSize: '0.7rem', color: 'text.disabled' }}>→</Typography>
              )}
              <Tooltip title={step ? `Step ${index + 1}: ${labNames[id] || id}` : (labNames[id] || id)}>
                <Chip
                  component={RouterLink}
                  to={hrefFor(id)}
                  label={labelFor(id)}
                  size="small"
                  clickable
                  aria-current={current ? 'page' : undefined}
                  icon={completedIds.has(id) ? <CheckIcon sx={{ fontSize: '0.8rem !important' }} /> : undefined}
                  color={current ? 'primary' : 'default'}
                  variant="outlined"
                  sx={{
                    height: 20,
                    textDecoration: 'none',
                    fontWeight: current ? 700 : 500,
                    '& .MuiChip-label': { fontSize: '0.7rem', px: 0.6 },
                    ...(current ? {} : { opacity: 0.72 }),
                  }}
                />
              </Tooltip>
            </React.Fragment>
          );
        })}
      </Box>
    ))}
  </Box>
);

LabSwitcher.propTypes = {
  groups: PropTypes.arrayOf(PropTypes.shape({
    id: PropTypes.string.isRequired,
    label: PropTypes.string.isRequired,
    labs: PropTypes.arrayOf(PropTypes.string).isRequired,
    series: PropTypes.bool,
    steps: PropTypes.objectOf(PropTypes.string),
  })).isRequired,
  ariaLabel: PropTypes.string.isRequired,
  currentId: PropTypes.string.isRequired,
  labNames: PropTypes.objectOf(PropTypes.string),
  completedIds: PropTypes.instanceOf(Set),
  labelFor: PropTypes.func,
  hrefFor: PropTypes.func,
};

export default LabSwitcher;
