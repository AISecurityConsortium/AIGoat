import React from 'react';
import PropTypes from 'prop-types';
import { Box, Typography } from '@mui/material';
import { meta, panel, sectionTitle } from './panelStyles';

/** One rail panel: a title, an optional lead line, and a bullet list or custom children. */
export const RailPanel = ({ title, lead = '', items = null, children = null }) => (
  <Box sx={panel}>
    <Typography sx={sectionTitle} component="h2">{title}</Typography>
    {lead && <Typography sx={{ ...meta, mt: 0.25 }}>{lead}</Typography>}
    {items && (
      <Box component="ul" sx={{ m: 0, mt: 0.75, pl: 2.25 }}>
        {items.map((item, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <Typography component="li" key={index} sx={{ fontSize: '0.82rem', lineHeight: 1.55, mb: 0.5, color: 'text.secondary' }}>
            {item}
          </Typography>
        ))}
      </Box>
    )}
    {children}
  </Box>
);

RailPanel.propTypes = {
  title: PropTypes.string.isRequired,
  lead: PropTypes.string,
  items: PropTypes.arrayOf(PropTypes.node),
  children: PropTypes.node,
};

/** Sticky aside used on the hub pages, matching the workbench rails. */
const HubRail = ({ label, children }) => (
  <Box
    component="aside"
    aria-label={label}
    sx={{
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 1.5,
      position: { md: 'sticky' },
      top: { md: 72 },
    }}
  >
    {children}
  </Box>
);

HubRail.propTypes = { label: PropTypes.string.isRequired, children: PropTypes.node.isRequired };

export default HubRail;
