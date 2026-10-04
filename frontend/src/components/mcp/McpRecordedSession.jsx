import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Box, Button, Chip, Collapse, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';
import { CodeBlock } from '../common';
import McpDefenseBehaviour from './McpDefenseBehaviour';
import McpEvidenceSubmit from './McpEvidenceSubmit';
import McpHintDisclosure from './McpHintDisclosure';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
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

const pretty = (value) => {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? '');
  }
};

const McpRecordedSession = ({ labId, lab, completed, onGoalMet }) => {
  const briefing = String(lab?.briefing || '').trim();
  const bits = briefing.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean);
  const [scenarioOpen, setScenarioOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [events, setEvents] = useState([]);
  const [openKey, setOpenKey] = useState('');
  const [takeaway, setTakeaway] = useState(completed ? (lab?.takeaway || {}) : {});
  const [tick, setTick] = useState(0);
  const [failure, setFailure] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await apiClient.post(API_CONFIG.ENDPOINTS.LAB_START(labId), null, { headers: authHeaders() });
        const log = await apiClient.get(API_CONFIG.ENDPOINTS.LAB_FIXTURE(labId), { headers: authHeaders() });
        if (cancelled) return;
        setSession(log.data?.session || {});
        setEvents(Array.isArray(log.data?.events) ? log.data.events : []);
        setFailure('');
      } catch (err) {
        if (!cancelled) setFailure(err.response?.data?.detail || 'The recorded session could not be loaded.');
      }
    })();
    return () => { cancelled = true; };
  }, [labId, tick]);

  const reset = async () => {
    await apiClient.post(API_CONFIG.ENDPOINTS.LAB_RESET(labId), null, { headers: authHeaders() });
    setTakeaway({});
    setOpenKey('');
    setTick((value) => value + 1);
    if (onGoalMet) onGoalMet(false);
  };

  const integrations = Array.isArray(session?.integrations) ? session.integrations : [];
  const descriptions = session?.approved_descriptions || {};
  const origins = session?.approved_origins || {};
  const controls = Array.isArray(session?.host_controls) ? session.host_controls : [];
  const title = String(lab?.name || '').replace(/^MCP\d+\s*[-–]\s*/, '');

  return (
    <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) minmax(320px, 420px)' }, alignItems: 'start' }}>
      <Box sx={{ minWidth: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography component="h1" sx={{ fontSize: '1.25rem', fontWeight: 700 }}>
            <Box component="span" sx={{ color: 'primary.light', mr: 1 }}>{String(lab?.id || '').toUpperCase()}</Box>
            {title}
          </Typography>
          {completed && <Chip label="Lab complete" size="small" color="success" variant="outlined" />}
          <Button size="small" onClick={reset} sx={{ textTransform: 'none', ml: 'auto', color: 'text.secondary' }}>
            Reset lab
          </Button>
        </Box>
        <Typography sx={{ mt: 1, fontSize: '0.9rem', lineHeight: 1.5 }}>{lab?.description}</Typography>
        {briefing && (
          <Box sx={{ mt: 1.25 }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }}>Scenario</Typography>
            <Typography sx={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'text.secondary', whiteSpace: 'pre-line' }}>
              {scenarioOpen || bits.length <= 2 ? briefing : bits.slice(0, 2).join('\n\n')}
            </Typography>
            {bits.length > 2 && (
              <Button size="small" onClick={() => setScenarioOpen((value) => !value)} sx={{ textTransform: 'none', px: 0 }}>
                {scenarioOpen ? 'Show less' : 'Read more'}
              </Button>
            )}
          </Box>
        )}
        {lab?.ui?.defense_behaviour && (
          <McpDefenseBehaviour behaviour={lab.ui.defense_behaviour} surface="mcp.host" />
        )}
        {lab?.ui?.hints && <McpHintDisclosure labId={labId} />}
        {session && (
          <Box sx={{ mt: 1.25, p: 1.25, borderRadius: '8px', border: (t) => `1px solid ${t.palette.divider}` }}>
            <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>Recorded session</Typography>
            <Typography sx={{ fontSize: '0.78rem', color: 'text.secondary', mt: 0.25 }}>{session.recorded_at}</Typography>
            <Typography sx={{ fontSize: '0.85rem', mt: 0.75 }}>
              <Box component="span" sx={{ fontWeight: 700 }}>Admin request. </Box>
              {session.admin_request}
            </Typography>
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mt: 1 }}>Integrations</Typography>
            {integrations.map((row) => (
              <Typography key={`${row.name}-${row.launch}`} sx={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                {`${row.name} · launch ${row.launch || 'none'}${row.enabled ? '' : ' · off'}`}
              </Typography>
            ))}
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mt: 1 }}>Approved descriptions on file</Typography>
            {Object.keys(descriptions).length === 0 && (
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>None on file.</Typography>
            )}
            {Object.entries(descriptions).map(([name, text]) => (
              <Typography key={name} sx={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                <Box component="span" sx={{ fontFamily: MONO }}>{name}</Box>
                {` · ${text}`}
              </Typography>
            ))}
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mt: 1 }}>Approved integration on file</Typography>
            {Object.keys(origins).length === 0 && (
              <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary' }}>None on file.</Typography>
            )}
            {Object.entries(origins).map(([name, integration]) => (
              <Typography key={name} sx={{ fontSize: '0.82rem', lineHeight: 1.45 }}>
                <Box component="span" sx={{ fontFamily: MONO }}>{name}</Box>
                {` · ${integration}`}
              </Typography>
            ))}
            <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mt: 1 }}>Controls at recording</Typography>
            <Typography sx={{ fontSize: '0.82rem', color: controls.length ? 'text.primary' : 'text.secondary' }}>
              {controls.length ? controls.join(' · ') : 'None recorded.'}
            </Typography>
          </Box>
        )}
        <Box sx={{ mt: 1.25, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {events.map((event) => {
            const key = `${event.time}-${event.method}-${event.tool || ''}-${event.server_name || ''}`;
            const open = openKey === key;
            return (
              <Box key={key} sx={{ borderRadius: '8px', border: (t) => `1px solid ${open ? alpha(t.palette.primary.main, 0.5) : t.palette.divider}` }}>
                <Box
                  role="button"
                  tabIndex={0}
                  aria-expanded={open}
                  onClick={() => setOpenKey(open ? '' : key)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setOpenKey(open ? '' : key);
                    }
                  }}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.75, px: 1, py: 0.7, cursor: 'pointer', minWidth: 0 }}
                >
                  <Typography sx={{ fontFamily: MONO, fontSize: '0.75rem', color: 'text.secondary', flexShrink: 0 }}>{event.time}</Typography>
                  <Typography sx={{ fontFamily: MONO, fontSize: '0.75rem', flexShrink: 0 }}>{event.method}</Typography>
                  {event.tool && (
                    <Typography noWrap sx={{ fontFamily: MONO, fontSize: '0.8rem', fontWeight: 700 }}>{event.tool}</Typography>
                  )}
                  <Typography noWrap sx={{ fontSize: '0.72rem', color: 'text.secondary', flex: 1, textAlign: 'right' }}>
                    {event.server_name || ''}
                  </Typography>
                  <ExpandMoreIcon sx={{ fontSize: '1rem', color: 'text.secondary', transform: open ? 'rotate(180deg)' : 'none' }} />
                </Box>
                <Collapse in={open}>
                  <Box sx={{ px: 1, pb: 1 }}>
                    {event.launch && (
                      <Typography sx={{ fontSize: '0.75rem', mb: 0.5 }}>{`Launch entry · ${event.launch}`}</Typography>
                    )}
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mb: 0.5 }}>Request</Typography>
                    <CodeBlock compact code={pretty(event.request)} language="json" />
                    <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, mt: 1, mb: 0.5 }}>Response</Typography>
                    <CodeBlock compact code={pretty(event.response)} language="json" />
                  </Box>
                </Collapse>
              </Box>
            );
          })}
        </Box>
        {failure && <Typography sx={{ mt: 1, color: 'error.main', fontSize: '0.85rem' }}>{failure}</Typography>}
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
        {!completed && session && (
          <McpEvidenceSubmit
            lab={lab}
            events={[]}
            labelForId={(id) => id}
            onEvaluation={(next, nextTakeaway) => {
              if (next?.exploit_triggered) {
                setTakeaway(nextTakeaway || {});
                if (onGoalMet) onGoalMet(true);
              }
            }}
          />
        )}
        {!session && !failure && (
          <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary' }}>Loading the recorded session.</Typography>
        )}
      </Box>
    </Box>
  );
};

McpRecordedSession.propTypes = {
  labId: PropTypes.string.isRequired,
  lab: PropTypes.object.isRequired,
  completed: PropTypes.bool,
  onGoalMet: PropTypes.func,
};

export default McpRecordedSession;
