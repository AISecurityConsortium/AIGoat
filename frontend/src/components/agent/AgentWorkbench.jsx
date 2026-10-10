import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Link as RouterLink } from 'react-router-dom';
import { Alert, Box, Button, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';
import LabHeader from '../common/LabHeader';
import McpDefenseBehaviour from '../mcp/McpDefenseBehaviour';
import McpHintDisclosure from '../mcp/McpHintDisclosure';
import { AGENT_NAV_GROUPS, AGENT_ORDER, HOST_STEPS, labChipLabel } from '../../utils/labTeaching';
import { currentUsername, switchToUser } from '../../utils/persona';
import AgentConsole from './AgentConsole';

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

const panel = {
  p: 1.5,
  borderRadius: '10px',
  border: (t) => `1px solid ${t.palette.divider}`,
  bgcolor: 'background.paper',
};
const inset = {
  borderRadius: '8px',
  border: (t) => `1px solid ${t.palette.divider}`,
  bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.18 : 0.02),
};
const sectionTitle = { fontWeight: 700, fontSize: '0.95rem' };
const meta = { fontSize: '0.78rem', color: 'text.secondary', lineHeight: 1.45 };
const quietButton = {
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

const labPath = (id) => (id === 'killchain-1' ? '/challenges?killchain=1' : `/labs/${id}`);

/** The two-role workspace for the admin-assistant labs (asi01-1, asi04-1). */
const HostWorkspace = ({ lab }) => {
  const user = currentUsername();
  const plant = HOST_STEPS[lab.id]?.plant;
  const isAdmin = user === 'admin';
  const isAlice = user === 'alice';
  const back = labPath(lab.id);
  const [error, setError] = useState('');
  const swap = async (target) => {
    setError('');
    try {
      await switchToUser(target, back);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Could not switch user');
    }
  };
  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
        <Typography sx={sectionTitle} component="h2">Workspace</Typography>
        <Chip size="small" variant="outlined" label={`Signed in as ${user || 'unknown'}`} sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.7rem' } }} />
      </Box>
      <Typography sx={{ ...meta, mb: 1.25 }}>
        {plant
          ? 'This lab spans two roles. Act as Alice to file the ticket, then as Admin to ask the assistant. The assistant opens in a new page with this lab selected.'
          : 'This lab runs on the admin assistant. The assistant opens in a new page with this lab selected.'}
      </Typography>
      {error && <Alert severity="error" sx={{ mb: 1 }}>{error}</Alert>}
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
        {plant && isAlice && (
          <Button component={RouterLink} to="/support" variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>
            File the ticket
          </Button>
        )}
        {plant && isAlice && (
          <Button variant="outlined" size="small" onClick={() => swap('admin')} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Switch to Admin
          </Button>
        )}
        {plant && isAdmin && (
          <Button variant="outlined" size="small" onClick={() => swap('alice')} sx={{ textTransform: 'none', fontWeight: 600 }}>
            Switch to Alice
          </Button>
        )}
        {isAdmin && (
          <Button component={RouterLink} to={`/admin/assistant?lab=${lab.id}`} variant="contained" size="small" sx={{ textTransform: 'none', fontWeight: 700 }}>
            Open the assistant
          </Button>
        )}
        {!plant && !isAdmin && (
          <Button variant="contained" size="small" onClick={() => swap('admin')} sx={{ textTransform: 'none', fontWeight: 700 }}>
            Switch to Admin
          </Button>
        )}
      </Box>
      {plant && isAlice && (
        <Typography sx={{ ...meta, mt: 1 }}>The assistant is an Admin tool. Switch to Admin after the ticket is filed.</Typography>
      )}
    </Box>
  );
};

HostWorkspace.propTypes = { lab: PropTypes.object.isRequired }; // eslint-disable-line react/forbid-prop-types

const NO_NAMES = {};

const AgentWorkbench = ({
  lab, labId, goalMet = false, labNames = NO_NAMES, onCompletionChange,
}) => {
  const [resetKey, setResetKey] = useState(0);
  const [busy, setBusy] = useState(false);
  const [halted, setHalted] = useState(false);
  const [note, setNote] = useState(null);
  const [takeaway, setTakeaway] = useState(lab.takeaway || {});
  const ui = lab.ui || {};
  const isHost = lab.surface === 'mcp.host';
  const needsAdmin = ui.sign_in === 'admin';
  const user = currentUsername();
  const series = AGENT_NAV_GROUPS.find((group) => group.series && group.labs.includes(lab.id));
  const orderIndex = AGENT_ORDER.indexOf(lab.id);
  const nextId = orderIndex >= 0 ? AGENT_ORDER[orderIndex + 1] : '';
  const scenario = String(lab.briefing || '').split('\n').map((line) => line.trim()).filter(Boolean);
  const steps = Array.isArray(ui.steps) ? ui.steps : [];
  const evidence = Array.isArray(ui.evidence) ? ui.evidence : [];
  const takeawayRows = TAKEAWAY_ROWS.filter(([key]) => takeaway[key]);

  useEffect(() => {
    setTakeaway(lab.takeaway || {});
    setHalted(false);
    setNote(null);
  }, [lab]);

  useEffect(() => {
    if (!goalMet) return undefined;
    let cancelled = false;
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_DETAIL(labId), { headers: authHeaders() })
      .then(({ data }) => { if (!cancelled) setTakeaway(data.takeaway || {}); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [goalMet, labId, resetKey]);

  useEffect(() => {
    if (goalMet) setNote((current) => (current?.severity === 'success' ? null : current));
  }, [goalMet]);

  const onGoalMet = useCallback((done) => {
    if (done && !goalMet) onCompletionChange(true);
  }, [goalMet, onCompletionChange]);

  const onReset = async () => {
    setBusy(true);
    setNote(null);
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.LAB_RESET(labId), null, { headers: authHeaders() });
      setResetKey((key) => key + 1);
      setHalted(false);
      setTakeaway({});
      onCompletionChange(false);
      setNote({ severity: 'success', text: 'Lab reset. Notes, completion, hints, and anything this lab changed are cleared.' });
    } catch (err) {
      setNote({ severity: 'error', text: err.response?.data?.detail || err.message || 'Reset failed' });
    } finally {
      setBusy(false);
    }
  };

  const onHalt = async () => {
    setBusy(true);
    setNote(null);
    try {
      await apiClient.post(API_CONFIG.ENDPOINTS.LAB_HALT(labId), null, { headers: authHeaders() });
      setHalted(true);
      setNote({ severity: 'warning', text: 'Halted. Running runs are cancelled and new runs are refused until you reset the lab.' });
    } catch (err) {
      setNote({ severity: 'error', text: err.response?.data?.detail || err.message || 'Halt failed' });
    } finally {
      setBusy(false);
    }
  };

  const mismatch = needsAdmin && user && user !== 'admin';

  return (
    <Box sx={{ maxWidth: 1560, mx: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 7fr) minmax(300px, 3fr)', lg: 'minmax(0, 7fr) minmax(340px, 3fr)' },
        }}
      >
        <Box sx={{ ...panel, p: 2, minWidth: 0 }}>
          <LabHeader
            lab={lab}
            goalMet={goalMet}
            objective={ui.goal || lab.description}
            series={series}
            labelFor={labChipLabel}
            showDifficulty
          />

          {mismatch && (
            <Alert
              severity="warning"
              sx={{ mt: 1.25 }}
              action={(
                <Button
                  color="inherit"
                  size="small"
                  onClick={() => switchToUser('admin', labPath(lab.id)).catch(() => {})}
                  sx={{ textTransform: 'none', fontWeight: 700 }}
                >
                  Switch to Admin
                </Button>
              )}
            >
              This lab runs as Admin. You are signed in as {user}, so the admin tools are not available.
            </Alert>
          )}

          {goalMet && takeawayRows.length > 0 && (
            <Box
              component="section"
              aria-label="Security takeaway"
              sx={{
                mt: 1.25,
                p: 1.5,
                borderRadius: '8px',
                border: (t) => `1px solid ${alpha(t.palette.success.main, 0.45)}`,
                bgcolor: (t) => alpha(t.palette.success.main, 0.06),
              }}
            >
              <Typography sx={{ ...sectionTitle, mb: 0.75 }}>Security takeaway</Typography>
              <Box sx={{ display: 'grid', gap: 1, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
                {takeawayRows.map(([key, title]) => (
                  <Box key={key}>
                    <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.15 }}>{title}</Typography>
                    <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.5, color: 'text.secondary' }}>{takeaway[key]}</Typography>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {scenario.length > 0 && (
            <Box sx={{ mt: 1.25 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }} component="h2">Scenario</Typography>
              {scenario.map((paragraph) => (
                <Typography key={paragraph} sx={{ fontSize: '0.85rem', lineHeight: 1.55, color: 'text.secondary', mb: 0.75 }}>
                  {paragraph}
                </Typography>
              ))}
            </Box>
          )}

          {steps.length > 0 && (
            <Box sx={{ mt: 1.25 }}>
              <Typography sx={{ fontWeight: 700, fontSize: '0.85rem', mb: 0.25 }} component="h2">What to do</Typography>
              <Box component="ol" sx={{ m: 0, pl: 2.5 }}>
                {steps.map((step) => (
                  <Typography component="li" key={step} sx={{ fontSize: '0.85rem', lineHeight: 1.55, mb: 0.5 }}>
                    {step}
                  </Typography>
                ))}
              </Box>
            </Box>
          )}

          <McpDefenseBehaviour behaviour={ui.defense_behaviour || lab.expected_by_level} surface={lab.surface} />

          <Box sx={{ ...inset, p: 1.25, mt: 1.25 }}>
            {isHost ? (
              <HostWorkspace lab={lab} />
            ) : (
              <AgentConsole
                key={`${labId}-${resetKey}`}
                labId={labId}
                lab={lab}
                onGoalMet={onGoalMet}
              />
            )}
          </Box>
        </Box>

        <Box
          component="aside"
          aria-label="Lab status, hints, and controls"
          sx={{
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
            position: { md: 'sticky' },
            top: { md: 72 },
          }}
        >
          <Box sx={panel}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.75 }}>
              <Typography sx={sectionTitle} component="h2">Lab status</Typography>
              <Box sx={{ flex: 1 }} />
              <Chip
                size="small"
                color={goalMet ? 'success' : 'default'}
                variant="outlined"
                label={goalMet ? 'Complete' : 'In progress'}
                sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.7rem', fontWeight: 700 } }}
              />
              {halted && <Chip size="small" color="warning" variant="outlined" label="Halted" sx={{ height: 20, '& .MuiChip-label': { fontSize: '0.7rem', fontWeight: 700 } }} />}
            </Box>
            {ui.done_when && (
              <Typography sx={{ ...meta, mb: 1 }}>
                <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>Done when: </Box>
                {ui.done_when}
              </Typography>
            )}
            {evidence.length > 0 && (
              <>
                <Typography sx={{ fontWeight: 700, fontSize: '0.78rem', mb: 0.25 }}>Evidence to read</Typography>
                <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                  {evidence.map((item) => (
                    <Typography component="li" key={item} sx={{ ...meta, mb: 0.25 }}>{item}</Typography>
                  ))}
                </Box>
              </>
            )}
            {goalMet && nextId && (
              <Button
                component={RouterLink}
                to={labPath(nextId)}
                size="small"
                variant="outlined"
                sx={{ textTransform: 'none', fontWeight: 600, mt: 1.25 }}
              >
                {`Next lab: ${labNames[nextId] || labChipLabel(nextId)} →`}
              </Button>
            )}
          </Box>

          <Box sx={panel}>
            <Typography sx={sectionTitle} component="h2">Controls</Typography>
            <McpHintDisclosure labId={labId} />
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1.25 }}>
              <Button size="small" variant="outlined" color="inherit" onClick={onReset} disabled={busy} sx={quietButton}>
                Reset lab
              </Button>
              {ui.halt && !isHost && (
                <Button size="small" variant="outlined" color="inherit" onClick={onHalt} disabled={busy || halted} sx={quietButton}>
                  Halt runs
                </Button>
              )}
            </Box>
            <Typography sx={{ ...meta, mt: 0.75 }}>
              {ui.halt
                ? 'Reset clears notes, completion, and the halt. Halt cancels running runs and refuses new ones until you reset.'
                : 'Reset clears this lab\'s notes, completion, and hints, and restores anything it changed.'}
            </Typography>
            {note && <Alert severity={note.severity} sx={{ mt: 1 }}>{note.text}</Alert>}
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

AgentWorkbench.propTypes = {
  lab: PropTypes.object.isRequired, // eslint-disable-line react/forbid-prop-types
  labId: PropTypes.string.isRequired,
  goalMet: PropTypes.bool,
  labNames: PropTypes.objectOf(PropTypes.string),
  onCompletionChange: PropTypes.func.isRequired,
};

export default AgentWorkbench;
