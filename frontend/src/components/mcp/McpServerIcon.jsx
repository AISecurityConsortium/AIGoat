import React from 'react';
import PropTypes from 'prop-types';
import { Box } from '@mui/material';
import { alpha } from '@mui/material/styles';

// Every glyph shares one palette so the icon identifies an integration without implying how far to trust it.
const GLYPHS = {
  shop_catalog: (
    <>
      <path d="M4 7.5 12 4l8 3.5-8 3.5-8-3.5Z" />
      <path d="M4 7.5v9L12 20l8-3.5v-9" />
      <path d="M12 11v9" />
    </>
  ),
  shadow_shop: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="1.5" />
      <rect x="13" y="4" width="7" height="7" rx="1.5" />
      <rect x="4" y="13" width="7" height="7" rx="1.5" />
      <path d="M13 16.5h7M16.5 13v7" />
    </>
  ),
  community_support: (
    <>
      <path d="M5 6.5A2.5 2.5 0 0 1 7.5 4h9A2.5 2.5 0 0 1 19 6.5v6a2.5 2.5 0 0 1-2.5 2.5H11l-4 4v-4h0.5" />
      <path d="M8.5 8.5h7M8.5 11.5h4.5" />
    </>
  ),
  internal_shop: (
    <>
      <path d="M4 20V9l8-5 8 5v11" />
      <path d="M9 20v-6h6v6" />
      <path d="M4 20h16" />
    </>
  ),
};

const FALLBACK = (
  <>
    <rect x="4" y="4.5" width="16" height="6" rx="1.5" />
    <rect x="4" y="13.5" width="16" height="6" rx="1.5" />
    <path d="M7.5 7.5h.01M7.5 16.5h.01" />
  </>
);

const McpServerIcon = ({ serverId, active = true, size = 34 }) => (
  <Box
    aria-hidden="true"
    sx={{
      width: size,
      height: size,
      flexShrink: 0,
      display: 'grid',
      placeItems: 'center',
      borderRadius: '8px',
      color: 'primary.light',
      bgcolor: (t) => alpha(t.palette.primary.main, active ? 0.16 : 0.07),
      border: (t) => `1px solid ${alpha(t.palette.primary.main, active ? 0.45 : 0.2)}`,
    }}
  >
    <Box
      component="svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      sx={{ width: Math.round(size * 0.55), height: Math.round(size * 0.55) }}
    >
      {GLYPHS[serverId] || FALLBACK}
    </Box>
  </Box>
);

McpServerIcon.propTypes = {
  serverId: PropTypes.string,
  active: PropTypes.bool,
  size: PropTypes.number,
};

export default McpServerIcon;
