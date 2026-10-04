import React, { useEffect, useState } from 'react';
import { Box, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

const STEPS = [
  {
    title: 'MCP Server',
    body: 'A lab with one MCP server already has it selected. That is context, not a task. A lab with several integrations lets you select one. Selecting a server does not call it.',
  },
  {
    title: 'Identify',
    body: 'Sends server/discover. The reply is who the server says it is. That claim is not proof of which program this client launched.',
  },
  {
    title: 'List tools',
    body: 'Sends tools/list. You get each tool name, description, and arguments. Listing does not run a tool.',
  },
  {
    title: 'Run',
    body: 'Sends tools/call. The result appears under the tool and is saved in MCP Interaction History. A call does not finish the lab.',
  },
  {
    title: 'MCP Interaction History',
    body: 'Every exchange, in order. Request is what the client sent. Response is what came back.',
  },
  {
    title: 'Submit evidence',
    body: 'Pick a recorded result that supports your conclusion, then state the conclusion. The lab finishes only when the evidence supports it.',
  },
];

const SEEN = 'aigoat_mcp_guide_seen';

const McpClientGuide = () => {
  const [open, setOpen] = useState(() => {
    try {
      return !localStorage.getItem(SEEN);
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(SEEN, '1');
    } catch {
      /* ignore private-mode storage failures */
    }
  }, []);

  return (
    <Box
      sx={{
        mt: 1.25,
        borderRadius: '8px',
        border: (t) => `1px solid ${t.palette.divider}`,
        bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.18 : 0.02),
        overflow: 'hidden',
      }}
    >
      <Box
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            setOpen((value) => !value);
          }
        }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.25,
          py: 0.75,
          cursor: 'pointer',
        }}
      >
        <ChevronRightIcon sx={{ fontSize: '1.1rem', color: 'text.secondary', transform: open ? 'rotate(90deg)' : 'none' }} />
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>How to use this client</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {`${STEPS.length} points`}
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box
          sx={{
            px: 1.5,
            pb: 1.25,
            display: 'grid',
            gap: 1,
            gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, minmax(0, 1fr))', xl: 'repeat(3, minmax(0, 1fr))' },
          }}
        >
          {STEPS.map((step) => (
            <Box key={step.title}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{step.title}</Typography>
              <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.45, color: 'text.secondary' }}>
                {step.body}
              </Typography>
            </Box>
          ))}
        </Box>
      </Collapse>
    </Box>
  );
};

export default McpClientGuide;
