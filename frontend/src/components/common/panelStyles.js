import { alpha } from '@mui/material/styles';

/** Panel, inset, and type tokens shared with the MCP and Agentic workbenches. */
export const panel = {
  p: 1.5,
  borderRadius: '10px',
  border: (t) => `1px solid ${t.palette.divider}`,
  bgcolor: 'background.paper',
};

export const inset = {
  borderRadius: '8px',
  border: (t) => `1px solid ${t.palette.divider}`,
  bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.18 : 0.02),
};

export const sectionTitle = { fontWeight: 700, fontSize: '0.95rem' };

export const meta = { fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.45 };

export const mono = { fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace' };

export const chipSx = { height: 20, '& .MuiChip-label': { fontSize: '0.7rem', px: 0.75 } };

export const quietButton = {
  textTransform: 'none',
  fontSize: '0.78rem',
  py: 0.25,
  px: 1.25,
  minWidth: 0,
  borderColor: 'divider',
  color: 'text.secondary',
  '&:hover': { borderColor: 'text.secondary', color: 'text.primary', bgcolor: (t) => alpha(t.palette.text.primary, 0.05) },
  '&.Mui-focusVisible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 2 },
};
