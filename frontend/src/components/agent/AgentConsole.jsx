import React, { useCallback, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Chip, CircularProgress, TextField, Typography,
} from '@mui/material';
import { PageHeader, SectionCard, EmptyState, CodeBlock, TranscriptViewer } from '../common';
import { useDefense } from '../../contexts/DefenseContext';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';
import ApprovalDialog from './ApprovalDialog';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const decisionColor = (decision) => {
  if (decision === 'deny') return 'error';
  if (decision === 'require_approval') return 'warning';
  if (decision === 'allow') return 'success';
  return 'default';
};

const AgentConsole = ({ labId, lab }) => {
  const { defenseLevel } = useDefense();
  const [goal, setGoal] = useState('');
  const [run, setRun] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const pending = run?.pending;

  const refresh = useCallback(async (runId) => {
    const { data } = await apiClient.get(API_CONFIG.ENDPOINTS.AGENT_RUN(runId), {
      headers: authHeaders(),
    });
    setRun(data);
    return data;
  }, []);

  useEffect(() => {
    if (!run?.run_id || run.status !== 'running') return undefined;
    const timer = setInterval(() => {
      refresh(run.run_id).catch(() => {});
    }, 1500);
    return () => clearInterval(timer);
  }, [run?.run_id, run?.status, refresh]);

  const startRun = async () => {
    const text = goal.trim();
    if (!text) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post(
        API_CONFIG.ENDPOINTS.AGENT_RUNS,
        {
          lab_id: labId,
          goal: text,
          defense_level: defenseLevel,
        },
        { headers: authHeaders() },
      );
      setRun(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Run failed');
    } finally {
      setBusy(false);
    }
  };

  const decide = async (decision) => {
    if (!run?.run_id || pending == null) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await apiClient.post(
        API_CONFIG.ENDPOINTS.AGENT_APPROVE(run.run_id),
        { step_seq: pending.step_seq, decision },
        { headers: authHeaders() },
      );
      setRun(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Approval failed');
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!run?.run_id) return;
    setBusy(true);
    try {
      const { data } = await apiClient.post(
        API_CONFIG.ENDPOINTS.AGENT_CANCEL(run.run_id),
        {},
        { headers: authHeaders() },
      );
      setRun(data);
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  const steps = run?.steps || [];

  return (
    <Box>
      <PageHeader
        title={lab?.name || 'Shop agent'}
        subtitle={lab?.objective || 'Send a goal. The trace is the lesson — watch the tool the broker was asked to run.'}
      />
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>{String(error)}</Alert>
      )}
      <SectionCard title="Goal" dense>
        <TextField
          multiline
          minRows={3}
          fullWidth
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder="Refund order 1003 now."
        />
        <Box sx={{ mt: 1.5, display: 'flex', gap: 1 }}>
          <Button variant="contained" onClick={startRun} disabled={busy || !goal.trim()}>
            {busy ? <CircularProgress size={18} /> : 'Run'}
          </Button>
          {run && (run.status === 'running' || run.status === 'awaiting_approval') && (
            <Button onClick={cancel} disabled={busy}>Cancel</Button>
          )}
        </Box>
      </SectionCard>

      {run && (
        <Box sx={{ mt: 2 }} aria-live="polite">
          <Typography sx={{ mb: 1, fontWeight: 600 }}>
            Status: {run.status}
            {' · '}
            step {steps.length} of {run.max_steps}
            {' · '}
            L{run.defense_level}
          </Typography>
          {steps.length === 0 ? (
            <EmptyState title="No steps yet" description="The agent has not taken an action." />
          ) : (
            <Box component="ol" sx={{ m: 0, pl: 3 }}>
              {steps.map((step) => (
                <Box component="li" key={`${step.seq}-${step.action}`} sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 700 }}>
                    {step.action || 'finish'}
                    {step.decision && (
                      <Chip
                        size="small"
                        label={`${step.decision}${step.control_id ? ` · ${step.control_id}` : ''}`}
                        color={decisionColor(step.decision)}
                        sx={{ ml: 1 }}
                      />
                    )}
                  </Typography>
                  {step.thought ? (
                    <Typography sx={{ color: 'text.secondary', fontSize: '0.85rem', mt: 0.5 }}>
                      {step.thought}
                    </Typography>
                  ) : null}
                  <CodeBlock code={JSON.stringify(step.action_input || {}, null, 2)} language="json" />
                  {step.observation ? (
                    <Typography sx={{ fontFamily: 'monospace', fontSize: '0.8rem', mt: 0.5 }}>
                      {step.observation}
                    </Typography>
                  ) : null}
                </Box>
              ))}
            </Box>
          )}
          {run.answer ? (
            <SectionCard title="Final answer" dense>
              <Typography>{run.answer}</Typography>
            </SectionCard>
          ) : null}
          {run.transcript && run.transcript.length > 0 ? (
            <Box sx={{ mt: 2 }}>
              <SectionCard title="Transcript" dense>
                <TranscriptViewer events={run.transcript} />
              </SectionCard>
            </Box>
          ) : null}
        </Box>
      )}

      <ApprovalDialog
        open={run?.status === 'awaiting_approval' && Boolean(pending)}
        tool={pending?.tool}
        arguments={pending?.arguments}
        onApprove={() => decide('approve')}
        onDeny={() => decide('deny')}
      />
    </Box>
  );
};

AgentConsole.propTypes = {
  labId: PropTypes.string.isRequired,
  lab: PropTypes.object, // eslint-disable-line react/forbid-prop-types
};

AgentConsole.defaultProps = {
  lab: null,
};

export default AgentConsole;
