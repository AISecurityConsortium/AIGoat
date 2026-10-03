import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography,
} from '@mui/material';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const REASON = {
  stage_incomplete: 'That step is not finished yet.',
  wrong_server: 'That call reached a different server than this step needs.',
  empty_args: 'The call had an empty argument.',
  call_failed: 'That call failed on the server.',
  submission_missing: 'Submit your finding to finish.',
  submission_mismatch: 'One of the answers does not match this attempt.',
};

export function LabBriefing({ text }) {
  if (!text) return null;
  return (
    <Alert severity="info" sx={{ mb: 1.5 }}>
      <Typography sx={{ fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>{text}</Typography>
    </Alert>
  );
}

export function LabProgress({ stages }) {
  if (!stages?.length) return null;
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, mb: 1.5 }}>
      {stages.map((stage) => (
        <Typography key={stage.id} sx={{ fontSize: '0.75rem' }}>
          {stage.met ? 'Done' : 'Open'}
          {' · '}
          {stage.label}
        </Typography>
      ))}
    </Box>
  );
}

export function HintLadder({ labId }) {
  const [hints, setHints] = useState([]);
  const [total, setTotal] = useState(5);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.LAB_PROGRESS(labId), { headers: authHeaders() });
    setHints(data.hints || []);
  };

  useEffect(() => {
    load().catch(() => {});
    // The ladder reloads when the lab changes, not on every parent render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labId]);

  const next = async () => {
    setBusy(true);
    try {
      const { data } = await apiClient.post(API_CONFIG.ENDPOINTS.LAB_HINT(labId), {}, { headers: authHeaders() });
      setHints(data.hints || []);
      setTotal(data.total || 5);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      {hints.map((hint, index) => (
        <Typography key={hint} sx={{ fontSize: '0.75rem', mb: 0.5 }}>
          {`Hint ${index + 1}. ${hint}`}
        </Typography>
      ))}
      {hints.length < total && (
        <Button size="small" variant="outlined" disabled={busy} onClick={next}>
          {`Next hint (${hints.length + 1} of ${total})`}
        </Button>
      )}
    </Box>
  );
}

export function EvidenceSubmission({ lab, onEvaluation }) {
  const fields = lab.submission_fields || [];
  const [values, setValues] = useState({});
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  if (!fields.length) return null;

  const submit = async () => {
    setBusy(true);
    setNote('');
    try {
      const { data } = await apiClient.post(
        API_CONFIG.ENDPOINTS.LAB_SUBMIT(lab.id),
        { fields: values },
        { headers: authHeaders() },
      );
      if (onEvaluation) onEvaluation(data.evaluation);
      const code = data.evaluation?.reason_code;
      setNote(data.evaluation?.exploit_triggered ? 'Finding recorded.' : (REASON[code] || 'Not yet.'));
    } catch (err) {
      setNote(err.response?.data?.detail || err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mb: 1.5 }}>
      {fields.map((name) => (
        <TextField
          key={name}
          size="small"
          label={name.replace(/_/g, ' ')}
          value={values[name] || ''}
          onChange={(event) => setValues((prev) => ({ ...prev, [name]: event.target.value }))}
        />
      ))}
      <Button size="small" variant="contained" disabled={busy} onClick={submit}>Submit finding</Button>
      {note && <Typography sx={{ fontSize: '0.75rem' }}>{note}</Typography>}
    </Box>
  );
}

export function SolutionReveal({ labId, revealed, onRevealed }) {
  const [open, setOpen] = useState(false);
  const [solution, setSolution] = useState(null);

  const reveal = async () => {
    const { data } = await apiClient.post(API_CONFIG.ENDPOINTS.LAB_SOLUTION(labId), {}, { headers: authHeaders() });
    setSolution(data.solution || {});
    setOpen(false);
    if (onRevealed) onRevealed();
  };

  return (
    <Box sx={{ mb: 1.5 }}>
      <Button size="small" onClick={() => setOpen(true)}>Show the solution</Button>
      {revealed && !solution && (
        <Typography sx={{ fontSize: '0.75rem', mt: 0.5 }}>Solution revealed. This lab is not complete until you finish it.</Typography>
      )}
      {solution && (
        <Box sx={{ mt: 1 }}>
          <Typography sx={{ fontSize: '0.8125rem', fontWeight: 700 }}>{solution.summary}</Typography>
          {(solution.steps || []).map((step) => (
            <Typography key={step} sx={{ fontSize: '0.75rem' }}>{step}</Typography>
          ))}
        </Box>
      )}
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Show the solution?</DialogTitle>
        <DialogContent>
          <Typography sx={{ fontSize: '0.875rem' }}>
            Reading the solution does not complete the lab and does not award a flag.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button onClick={reveal}>Show it</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export function OutcomeBanner({ evaluation, solvedAfterReveal }) {
  if (!evaluation?.exploit_triggered) {
    const code = evaluation?.reason_code;
    if (!code) return null;
    return <Alert severity="warning" sx={{ mb: 1.5 }}>{REASON[code] || 'Not yet.'}</Alert>;
  }
  return (
    <Alert severity="success" sx={{ mb: 1.5 }}>
      {solvedAfterReveal ? 'Solved after reveal.' : 'Lab complete.'}
      {evaluation.flag ? ` Flag: ${evaluation.flag}` : ''}
    </Alert>
  );
}

export function IncidentLog({ labId, enabled }) {
  const [events, setEvents] = useState([]);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    apiClient.get(API_CONFIG.ENDPOINTS.LAB_FIXTURE(labId), { headers: authHeaders() })
      .then(({ data }) => { if (!cancelled) setEvents(data.events || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [labId, enabled]);
  if (!enabled || !events.length) return null;
  return (
    <Box component="ol" sx={{ fontSize: '0.75rem', mb: 1.5, pl: 2 }}>
      {events.map((event) => (
        <li key={event.seq}>
          {`#${event.seq} ${event.method} server ${event.server_id} claimed ${event.claimed_name || '-'} tool ${event.tool || '-'} ${event.note || ''}`}
        </li>
      ))}
    </Box>
  );
}

export default function LabGuide({ lab, evaluation }) {
  const [revealed, setRevealed] = useState(Boolean(lab.solution_revealed));
  if (!lab?.briefing) return null;
  return (
    <Box sx={{ mb: 2 }}>
      <LabBriefing text={lab.briefing} />
      <IncidentLog labId={lab.id} enabled={Boolean(lab.has_fixture)} />
      <LabProgress stages={evaluation?.stages || lab.stages} />
      <OutcomeBanner evaluation={evaluation} solvedAfterReveal={revealed && evaluation?.exploit_triggered} />
      {lab.ui?.agent_mode && (
        <Button
          size="small"
          sx={{ mb: 1 }}
          onClick={async () => {
            const { data } = await apiClient.post(
              `/api/labs/${lab.id}/agent-step`,
              { goal: 'Answer with the tool list.' },
              { headers: authHeaders() },
            );
            window.alert(data.call ? `Planner would call ${data.call.name}. You still have to do it.` : 'Planner did not follow the tool list.');
          }}
        >
          Ask the planner
        </Button>
      )}
      <HintLadder labId={lab.id} />
      <SolutionReveal labId={lab.id} revealed={revealed} onRevealed={() => setRevealed(true)} />
    </Box>
  );
}

IncidentLog.propTypes = {
  labId: PropTypes.string.isRequired,
  enabled: PropTypes.bool,
};
LabBriefing.propTypes = { text: PropTypes.string };
LabProgress.propTypes = { stages: PropTypes.arrayOf(PropTypes.object) };
HintLadder.propTypes = { labId: PropTypes.string.isRequired };
EvidenceSubmission.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string,
    submission_fields: PropTypes.arrayOf(PropTypes.string),
  }).isRequired,
  onEvaluation: PropTypes.func,
};
SolutionReveal.propTypes = {
  labId: PropTypes.string.isRequired,
  revealed: PropTypes.bool,
  onRevealed: PropTypes.func,
};
OutcomeBanner.propTypes = {
  evaluation: PropTypes.shape({
    exploit_triggered: PropTypes.bool,
    reason_code: PropTypes.string,
  }),
  solvedAfterReveal: PropTypes.bool,
};
LabGuide.propTypes = {
  lab: PropTypes.object.isRequired,
  evaluation: PropTypes.object,
};
