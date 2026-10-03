import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Button, IconButton, Paper, Typography } from '@mui/material';
import { Close as CloseIcon } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getStartHereDismissedKey, START_HERE_SHOW_EVENT } from '../../config/learningPath';

const DOORS = [
  {
    id: 'learn',
    title: 'Learn',
    body: 'Read one risk before you try to break anything.',
    action: 'OWASP Top 10',
    path: '/owasp-top-10',
  },
  {
    id: 'try',
    title: 'Try',
    body: 'Make Cracky ignore a rule.',
    action: 'First lab',
    path: '/attacks?framework=owasp-llm-2026&lab=llm01-1',
  },
  {
    id: 'console',
    title: 'Console',
    body: 'Open a workspace and call a tool.',
    action: 'MCP',
    path: '/mcp',
  },
];

/**
 * Three doors for logged-in non-admin learners on /home.
 * Hidden when aigoat_start_here_dismissed_<username> is set.
 */
const StartHerePanel = ({ username = null }) => {
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(getStartHereDismissedKey()) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    const onShow = () => {
      try {
        localStorage.removeItem(getStartHereDismissedKey());
      } catch {
        /* ignore */
      }
      setDismissed(false);
    };
    const onStorage = (event) => {
      if (event.key === getStartHereDismissedKey()) {
        setDismissed(localStorage.getItem(getStartHereDismissedKey()) === '1');
      }
    };
    window.addEventListener(START_HERE_SHOW_EVENT, onShow);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(START_HERE_SHOW_EVENT, onShow);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(getStartHereDismissedKey(), '1');
    setDismissed(true);
  };

  if (dismissed) return null;
  if (!username || username === 'admin') return null;

  return (
    <Paper
      id="start-here"
      elevation={0}
      sx={{
        mb: 2,
        px: 1.25,
        py: 0.75,
        borderRadius: '12px',
        bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
        border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
      }}
    >
      <Typography sx={{ fontWeight: 700, fontSize: '0.8125rem', flexShrink: 0, pr: 0.5 }}>
        Start here
      </Typography>
      <Box sx={{ display: 'flex', flex: 1, flexWrap: 'wrap', gap: 0.75, minWidth: 0 }}>
        {DOORS.map((door) => (
          <Button
            key={door.id}
            size="small"
            onClick={() => navigate(door.path)}
            sx={{
              textTransform: 'none',
              justifyContent: 'flex-start',
              px: 1.25,
              py: 0.6,
              borderRadius: '8px',
              border: (t) => `1px solid ${t.palette.divider}`,
              color: 'text.primary',
              fontWeight: 500,
              fontSize: '0.8125rem',
              lineHeight: 1.3,
            }}
          >
            <Box component="span" sx={{ fontWeight: 700, mr: 0.75 }}>{door.title}</Box>
            <Box component="span" sx={{ color: 'text.secondary', fontWeight: 400 }}>{door.body}</Box>
          </Button>
        ))}
      </Box>
      <IconButton
        size="small"
        onClick={handleDismiss}
        aria-label="Dismiss Start here panel"
        sx={{ color: 'text.secondary', flexShrink: 0 }}
      >
        <CloseIcon sx={{ fontSize: '1rem' }} />
      </IconButton>
    </Paper>
  );
};

StartHerePanel.propTypes = {
  username: PropTypes.string,
};

export default StartHerePanel;
