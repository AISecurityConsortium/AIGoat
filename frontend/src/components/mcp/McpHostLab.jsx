import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box, Button, Chip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';
import McpDefenseBehaviour from './McpDefenseBehaviour';
import McpEvidenceSubmit from './McpEvidenceSubmit';
import McpHintDisclosure from './McpHintDisclosure';

const TAKEAWAY_ROWS = [
  ['learned', 'What you learned'],
  ['why', 'Why it matters'],
  ['defense', 'What changed across defense levels'],
  ['secure', 'What secure implementations should do'],
];

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const switchPersona = async (alicePath, labId) => {
  const current = localStorage.getItem('username');
  const target = current === 'admin' ? 'alice' : 'admin';
  if (current !== 'alice' && current !== 'admin') return;
  const res = await apiClient.get('/api/auth/demo-users/');
  const match = (res.data.users || []).find((row) => row.username === target);
  if (!match?.demo_token) return;
  localStorage.setItem('token', match.demo_token);
  localStorage.setItem('username', target);
  const adminPath = labId ? `/admin/assistant?lab=${labId}` : '/admin/assistant';
  window.location.assign(target === 'admin' ? adminPath : alicePath);
};

const McpHostLab = ({ labId, lab, completed, onGoalMet }) => {
  const briefing = String(lab?.briefing || '').trim();
  const bits = briefing.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [staff, setStaff] = useState(null);
  const [events, setEvents] = useState([]);
  const [takeaway, setTakeaway] = useState(completed ? (lab?.takeaway || {}) : {});
  const [tick, setTick] = useState(0);
  const steps = lab?.ui?.host_steps || {};
  const lines = Array.isArray(steps.lines) ? steps.lines : [];
  const readyKinds = new Set(lab?.ui?.submission?.ready_after || []);
  const ready = !readyKinds.size || events.some((event) => readyKinds.has(event.kind));

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiClient.post(API_CONFIG.ENDPOINTS.LAB_START(labId), null, { headers: authHeaders() });
        const progress = await apiClient.get(API_CONFIG.ENDPOINTS.LAB_PROGRESS(labId), { headers: authHeaders() });
        if (!cancelled) setEvents(Array.isArray(progress.data?.events) ? progress.data.events : []);
      } catch {
        /* the submit call reports its own failure */
      }
    })();
    return () => { cancelled = true; };
  }, [labId, tick, completed]);

  useEffect(() => {
    let cancelled = false;
    apiClient.get('/api/auth/demo-users/')
      .then(({ data }) => {
        const name = localStorage.getItem('username');
        const row = (data.users || []).find((item) => item.username === name);
        if (!cancelled) setStaff(Boolean(row?.is_staff));
      })
      .catch(() => { if (!cancelled) setStaff(false); });
    return () => { cancelled = true; };
  }, [labId]);

  const reset = async () => {
    await apiClient.post(API_CONFIG.ENDPOINTS.LAB_RESET(labId), null, { headers: authHeaders() });
    setTakeaway({});
    setTick((value) => value + 1);
    if (onGoalMet) onGoalMet(false);
  };

  const title = String(lab?.name || '').replace(/^MCP\d+\s*[-–]\s*/, '');

  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(320px, 420px)' }, alignItems: 'start' }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em' }}>
            <Box component="span" sx={{ color: 'primary.light', mr: 1 }}>{String(lab?.id || '').toUpperCase()}</Box>
            {title}
          </Typography>
          {completed && <Chip label="Lab complete" size="small" color="success" variant="outlined" />}
        </Box>
        <Typography sx={{ mt: 1, fontSize: '0.9rem', lineHeight: 1.5 }}>{lab?.description}</Typography>
        {briefing && (
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }}>Scenario</Typography>
            <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'text.secondary', whiteSpace: 'pre-line' }}>
              {scenarioOpen || bits.length <= 2 ? briefing : bits.slice(0, 2).join('\n\n')}
            </Typography>
            {bits.length > 2 && (
              <Button
                size="small"
                onClick={() => setScenarioOpen((value) => !value)}
                endIcon={<ExpandMoreIcon sx={{ transform: scenarioOpen ? 'rotate(180deg)' : 'none' }} />}
                sx={{ textTransform: 'none', px: 0, minWidth: 0, fontSize: '0.8rem' }}
              >
                {scenarioOpen ? 'Show less' : 'Read more'}
              </Button>
            )}
          </Box>
        )}
        {lines.length > 0 && (
          <Box sx={{ mt: 1.25, p: 1.25, borderRadius: '8px', border: (t) => `1px solid ${t.palette.divider}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.75 }}>How to investigate</Typography>
            {lines.map((line) => (
              <Typography key={line} sx={{ fontSize: '0.85rem', lineHeight: 1.5, color: 'text.secondary', mb: 0.5 }}>
                {line}
              </Typography>
            ))}
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
              {steps.plant && (
                <Button variant="outlined" onClick={() => switchPersona('/support', labId)} sx={{ textTransform: 'none' }}>
                  Switch persona
                </Button>
              )}
              <Button component={RouterLink} to={`/admin/assistant?lab=${labId}`} variant="contained" sx={{ textTransform: 'none' }}>
                Open assistant
              </Button>
              <Button variant="text" onClick={reset} sx={{ textTransform: 'none', color: 'text.secondary' }}>
                Reset lab
              </Button>
            </Box>
          </Box>
        )}
        {lab?.ui?.defense_behaviour && (
          <McpDefenseBehaviour behaviour={lab.ui.defense_behaviour} surface="mcp.host" />
        )}
        {lab?.ui?.hints && <McpHintDisclosure labId={labId} />}
        {completed && Object.keys(takeaway).length > 0 && (
          <Box sx={{ mt: 1.5, p: 1.5, borderRadius: '8px', border: (t) => `1px solid ${alpha(t.palette.success.main, 0.45)}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.75 }}>Security takeaway</Typography>
            {TAKEAWAY_ROWS.filter(([key]) => takeaway[key]).map(([key, label]) => (
              <Box key={key} sx={{ mb: 0.75 }}>
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem' }}>{label}</Typography>
                <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'text.secondary' }}>{takeaway[key]}</Typography>
              </Box>
            ))}
          </Box>
        )}
      </Box>
      <Box sx={{ minWidth: 0, maxHeight: { lg: 'calc(100vh - 220px)' }, overflowY: 'auto' }}>
        {staff === false && (
          <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.5, mb: 1 }}>
            Evidence for this lab is recorded under the admin persona. Switch to Admin to submit.
          </Typography>
        )}
        {staff && !completed && ready && (
          <McpEvidenceSubmit
            lab={lab}
            events={events}
            labelForId={(id) => id}
            onEvaluation={(next, nextTakeaway) => {
              setTick((value) => value + 1);
              if (next?.exploit_triggered) {
                setTakeaway(nextTakeaway || {});
                if (onGoalMet) onGoalMet(true);
              }
            }}
          />
        )}
        {staff && !completed && !ready && (
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', lineHeight: 1.5 }}>
            Investigate first. Your requests and results are recorded for this attempt.
          </Typography>
        )}
      </Box>
    </Box>
  );
};

McpHostLab.propTypes = {
  labId: PropTypes.string.isRequired,
  lab: PropTypes.object.isRequired,
  completed: PropTypes.bool,
  onGoalMet: PropTypes.func,
};

export default McpHostLab;
