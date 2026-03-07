import React, { useState, useRef } from 'react';
import {
  Box,
  Typography,
  ButtonBase,
  Popper,
  Paper,
  ClickAwayListener,
  Grow,
  Snackbar,
  Alert,
} from '@mui/material';
import { useDefense } from '../contexts/DefenseContext';
import { useThemeMode } from '../contexts/ThemeContext';

const DefenseLevelToggle = () => {
  const { defenseLevel, levelDetails, changeDefenseLevel, loading, LEVELS } = useDefense();
  const { mode } = useThemeMode();
  const isDark = mode === 'dark';
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const anchorRef = useRef(null);

  const handleSelect = async (level) => {
    if (level === defenseLevel) {
      setOpen(false);
      return;
    }
    const result = await changeDefenseLevel(level);
    setOpen(false);
    if (result.success) {
      const lvl = LEVELS[level];
      setFeedback({ severity: 'success', message: `Defense level set to ${lvl.icon} ${lvl.name}` });
    } else {
      setFeedback({ severity: 'error', message: result.error || 'Failed to change defense level' });
    }
  };

  const current = levelDetails;

  return (
    <>
      <ButtonBase
        ref={anchorRef}
        onClick={() => setOpen(prev => !prev)}
        disabled={loading}
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 0.75,
          px: 1.5,
          py: 0.75,
          borderRadius: '8px',
          border: `1px solid ${current.color}40`,
          bgcolor: `${current.color}15`,
          transition: 'all 0.2s',
          opacity: loading ? 0.6 : 1,
          '&:hover': { bgcolor: `${current.color}25` },
        }}
      >
        <Typography sx={{ fontSize: '0.85rem', lineHeight: 1 }}>{current.icon}</Typography>
        <Typography
          sx={{
            fontSize: '0.7rem',
            fontWeight: 700,
            color: current.color,
            letterSpacing: '0.04em',
          }}
        >
          {current.shortLabel}
        </Typography>
      </ButtonBase>

      <Popper open={open} anchorEl={anchorRef.current} placement="bottom-end" transition style={{ zIndex: 1300 }}>
        {({ TransitionProps }) => (
          <Grow {...TransitionProps} style={{ transformOrigin: 'right top' }}>
            <Paper
              sx={{
                mt: 1,
                p: 1,
                minWidth: 240,
                bgcolor: isDark ? '#1a1a2e' : '#ffffff',
                border: isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.12)',
                borderRadius: '12px',
                boxShadow: isDark ? '0 20px 40px rgba(0,0,0,0.5)' : '0 8px 24px rgba(0,0,0,0.12)',
              }}
            >
              <ClickAwayListener onClickAway={() => setOpen(false)}>
                <Box>
                  <Typography variant="caption" sx={{ color: isDark ? '#94a3b8' : '#64748b', px: 1.5, pt: 1, pb: 0.5, display: 'block', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.65rem' }}>
                    Defense Level
                  </Typography>
                  {Object.values(LEVELS).map((lvl) => (
                    <ButtonBase
                      key={lvl.level}
                      onClick={() => handleSelect(lvl.level)}
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1.5,
                        width: '100%',
                        px: 1.5,
                        py: 1,
                        borderRadius: '8px',
                        textAlign: 'left',
                        bgcolor: defenseLevel === lvl.level ? `${lvl.color}18` : 'transparent',
                        border: defenseLevel === lvl.level ? `1px solid ${lvl.color}40` : '1px solid transparent',
                        transition: 'all 0.15s',
                        '&:hover': { bgcolor: `${lvl.color}12` },
                      }}
                    >
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: '50%',
                          bgcolor: lvl.color,
                          flexShrink: 0,
                          boxShadow: defenseLevel === lvl.level ? `0 0 8px ${lvl.color}80` : 'none',
                        }}
                      />
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography sx={{ color: isDark ? '#e2e8f0' : '#1e293b', fontSize: '0.8rem', fontWeight: 600 }}>
                          {lvl.icon} {lvl.name}
                        </Typography>
                        <Typography sx={{ color: isDark ? '#64748b' : '#94a3b8', fontSize: '0.68rem', lineHeight: 1.3 }}>
                          {lvl.description}
                        </Typography>
                      </Box>
                    </ButtonBase>
                  ))}
                </Box>
              </ClickAwayListener>
            </Paper>
          </Grow>
        )}
      </Popper>

      <Snackbar
        open={!!feedback}
        autoHideDuration={2500}
        onClose={() => setFeedback(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        {feedback ? (
          <Alert severity={feedback.severity} onClose={() => setFeedback(null)} variant="filled" sx={{ borderRadius: '10px' }}>
            {feedback.message}
          </Alert>
        ) : undefined}
      </Snackbar>
    </>
  );
};

export default DefenseLevelToggle;
