import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Box, Collapse, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';
import { useDefense } from '../../contexts/DefenseContext';

const LEVEL_NAMES = { 0: 'Vulnerable', 1: 'Protected', 2: 'Hardened' };

const McpDefenseBehaviour = ({ behaviour, surface = 'mcp.client' }) => {
  const { defenseLevel } = useDefense();
  const [open, setOpen] = useState(false);
  const [levels, setLevels] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const token = localStorage.getItem('token');
    apiClient.get(API_CONFIG.ENDPOINTS.DEFENSE_LEVELS, {
      params: { surface },
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(({ data }) => { if (!cancelled) setLevels(Array.isArray(data?.levels) ? data.levels : []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [surface]);

  const byLevel = Object.fromEntries(levels.map((row) => [row.level, row]));
  const current = Number(defenseLevel) || 0;
  const toggle = () => setOpen((value) => !value);

  return (
    <Box
      sx={{
        mt: 1,
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
        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Defense behaviour</Typography>
        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary' }}>
          {`Current: L${current} · ${LEVEL_NAMES[current] || ''}`}
        </Typography>
      </Box>
      <Collapse in={open}>
        <Box sx={{ px: 1.25, pb: 1.25, display: 'grid', gap: 0.75, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, minmax(0, 1fr))' } }}>
          {[0, 1, 2].map((level) => {
            const active = level === current;
            const controls = byLevel[level]?.controls || [];
            return (
              <Box
                key={level}
                aria-current={active ? 'true' : undefined}
                sx={{
                  p: 1,
                  borderRadius: '8px',
                  border: (t) => `1px solid ${active ? t.palette.primary.main : t.palette.divider}`,
                  bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.08) : 'transparent'),
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, mb: 0.25 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>
                    {`L${level} · ${LEVEL_NAMES[level]}`}
                  </Typography>
                  {active && <Typography sx={{ fontSize: '0.7rem', color: 'primary.light' }}>current</Typography>}
                </Box>
                <Typography sx={{ fontSize: '0.78rem', lineHeight: 1.45, color: 'text.secondary' }}>
                  {behaviour?.[level] || behaviour?.[String(level)] || byLevel[level]?.intent || ''}
                </Typography>
                <Typography sx={{ fontSize: '0.72rem', lineHeight: 1.45, mt: 0.5 }}>
                  <Box component="span" sx={{ color: 'text.secondary' }}>Controls: </Box>
                  {controls.length ? controls.map((control) => control.name).join(', ') : 'none'}
                </Typography>
              </Box>
            );
          })}
        </Box>
      </Collapse>
    </Box>
  );
};

McpDefenseBehaviour.propTypes = {
  behaviour: PropTypes.object,
  surface: PropTypes.string,
};

export default McpDefenseBehaviour;
