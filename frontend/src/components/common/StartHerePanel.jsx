import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Button,
  Checkbox,
  IconButton,
  Paper,
  Typography,
} from '@mui/material';
import {
  CheckCircle as CheckCircleIcon,
  Close as CloseIcon,
  RadioButtonUnchecked as OpenCircleIcon,
  ArrowForward as ArrowForwardIcon,
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import {
  LEARNING_PATH,
  getCompletionStorageKey,
  getStartHereDismissedKey,
  START_HERE_SHOW_EVENT,
} from '../../config/learningPath';

const readCompleted = () => {
  try {
    const raw = localStorage.getItem(getCompletionStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

const writeCompleted = (next) => {
  localStorage.setItem(getCompletionStorageKey(), JSON.stringify(next));
};

/**
 * Dismissible guided path for logged-in non-admin learners on /home.
 * Shown unless aigoat_start_here_dismissed_<username> is set.
 * Dispatch window event "aigoat_start_here_show" (or clear the dismiss key) to restore.
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
  const [completed, setCompleted] = useState(readCompleted);

  const refreshCompleted = useCallback(() => {
    setCompleted(readCompleted());
  }, []);

  useEffect(() => {
    const onShow = () => {
      try {
        localStorage.removeItem(getStartHereDismissedKey());
      } catch {
        /* ignore */
      }
      setDismissed(false);
      refreshCompleted();
    };
    const onStorage = (e) => {
      if (!e.key || e.key === getCompletionStorageKey() || e.key === getStartHereDismissedKey()) {
        refreshCompleted();
        if (e.key === getStartHereDismissedKey()) {
          setDismissed(localStorage.getItem(getStartHereDismissedKey()) === '1');
        }
      }
    };
    window.addEventListener(START_HERE_SHOW_EVENT, onShow);
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', refreshCompleted);
    return () => {
      window.removeEventListener(START_HERE_SHOW_EVENT, onShow);
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', refreshCompleted);
    };
  }, [refreshCompleted]);

  const handleDismiss = () => {
    localStorage.setItem(getStartHereDismissedKey(), '1');
    setDismissed(true);
  };

  const toggleStep = (completionKey) => {
    setCompleted((prev) => {
      const next = { ...prev, [completionKey]: !prev[completionKey] };
      writeCompleted(next);
      return next;
    });
  };

  if (dismissed) return null;
  if (!username || username === 'admin') return null;

  const doneCount = LEARNING_PATH.filter((s) => !!completed[s.completionKey]).length;

  return (
    <Paper
      id="start-here"
      elevation={0}
      sx={{
        mb: 3,
        p: { xs: 2, md: 2.5 },
        borderRadius: '14px',
        bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
        border: (t) => `1px solid ${t.palette.custom?.border?.subtle ?? t.palette.divider}`,
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 1.5 }}>
        <Box>
          <Typography
            sx={{
              fontWeight: 700,
              fontSize: '1rem',
              letterSpacing: '-0.01em',
              color: (t) => t.palette.custom?.text?.heading ?? 'text.primary',
            }}
          >
            Start here
          </Typography>
          <Typography
            sx={{
              fontSize: '0.8rem',
              color: (t) => t.palette.custom?.text?.body ?? 'text.secondary',
              mt: 0.25,
            }}
          >
            A short path through the shop labs. {doneCount} of {LEARNING_PATH.length} done.
          </Typography>
        </Box>
        <IconButton
          size="small"
          onClick={handleDismiss}
          aria-label="Dismiss Start here panel"
          sx={{ color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary' }}
        >
          <CloseIcon sx={{ fontSize: '1.1rem' }} />
        </IconButton>
      </Box>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {LEARNING_PATH.map((step, index) => {
          const isDone = !!completed[step.completionKey];
          return (
            <Box
              key={step.id}
              sx={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 0.5,
                py: 1,
                px: 1,
                borderRadius: '10px',
                bgcolor: isDone
                  ? (t) => t.palette.custom?.overlay?.active ?? 'action.hover'
                  : 'transparent',
                border: (t) => `1px solid ${isDone ? (t.palette.custom?.border?.medium ?? t.palette.divider) : 'transparent'}`,
              }}
            >
              <Checkbox
                size="small"
                checked={isDone}
                onChange={() => toggleStep(step.completionKey)}
                icon={<OpenCircleIcon sx={{ fontSize: '1.15rem' }} />}
                checkedIcon={<CheckCircleIcon sx={{ fontSize: '1.15rem' }} />}
                sx={{
                  p: 0.5,
                  mt: 0.1,
                  color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                  '&.Mui-checked': { color: 'success.main' },
                }}
                inputProps={{ 'aria-label': `Mark ${step.title} complete` }}
              />
              <Box sx={{ flex: 1, minWidth: 0 }}>
                <Typography
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    color: (t) => t.palette.custom?.text?.heading ?? 'text.primary',
                    textDecoration: isDone ? 'line-through' : 'none',
                    opacity: isDone ? 0.75 : 1,
                  }}
                >
                  {index + 1}. {step.title}
                  <Box
                    component="span"
                    sx={{
                      ml: 1,
                      fontWeight: 500,
                      fontSize: '0.72rem',
                      color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                      textDecoration: 'none',
                    }}
                  >
                    {step.estimate}
                  </Box>
                </Typography>
                <Typography
                  sx={{
                    fontSize: '0.78rem',
                    lineHeight: 1.45,
                    color: (t) => t.palette.custom?.text?.body ?? 'text.secondary',
                  }}
                >
                  {step.outcome}
                </Typography>
                {step.hint && (
                  <Typography
                    sx={{
                      fontSize: '0.72rem',
                      mt: 0.35,
                      color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
                    }}
                  >
                    {step.hint}
                  </Typography>
                )}
              </Box>
              <Button
                size="small"
                endIcon={<ArrowForwardIcon sx={{ fontSize: '0.85rem !important' }} />}
                onClick={() => navigate(step.path)}
                sx={{
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  flexShrink: 0,
                  mt: 0.25,
                  color: (t) => t.palette.custom?.text?.accent ?? 'primary.main',
                }}
              >
                Go
              </Button>
            </Box>
          );
        })}
      </Box>
    </Paper>
  );
};

StartHerePanel.propTypes = {
  username: PropTypes.string,
};

export default StartHerePanel;
