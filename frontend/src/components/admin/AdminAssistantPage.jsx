import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, Chip, Switch, FormControlLabel, Alert } from '@mui/material';
import { apiClient as api } from '../../config/api';
import { useDefense } from '../../contexts/DefenseContext';
import ApprovalDialog from '../agent/ApprovalDialog';

const parseJson = (value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== '{' && trimmed[0] !== '[')) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const unwrapObservation = (raw) => {
  const data = parseJson(raw);
  if (!data || typeof data !== 'object' || Array.isArray(data)) return data;
  const text = data.text;
  if (Array.isArray(text) && text.length === 1) return parseJson(text[0]);
  if (typeof text === 'string') {
    const inner = parseJson(text);
    if (inner !== text) return inner;
  }
  return data;
};

const formatObservation = (raw) => {
  const data = unwrapObservation(raw);
  if (data && typeof data === 'object' && !Array.isArray(data) && data.redacted) {
    const control = data.control_id ? ` by ${data.control_id}` : '';
    return `Redacted${control}. ${data.reason || ''}`.trim();
  }
  if (data && Array.isArray(data.reviews)) {
    if (data.reviews.length === 0) return 'No reviews.';
    return data.reviews.map((row) => {
      const who = row.username || 'unknown';
      const rating = row.rating == null ? '' : `, rating ${row.rating}`;
      return `${who}${rating}: ${row.comment || ''}`;
    }).join('\n');
  }
  if (data && data.refunded === true) {
    return `Refund confirmed for order ${data.order_id}.`;
  }
  if (typeof data === 'string') return data;
  try {
    return JSON.stringify(data, null, 2);
  } catch {
    return String(raw || '');
  }
};

const decisionColor = (decision) => {
  if (decision === 'allow') return 'success';
  if (decision === 'deny') return 'error';
  if (decision === 'require_approval') return 'warning';
  return 'default';
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AdminAssistantPage = () => {
  const [params] = useSearchParams();
  // The admin assistant is the ASI01 goal-hijack surface. Default to that lab so
  // a visit from the nav (no ?lab= param) still runs the evaluator and applies
  // the synthetic refund/ticket-close impact.
  const labId = params.get('lab') || 'asi01-1';
  const { defenseLevel, levelDetails } = useDefense();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [run, setRun] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const loadIntegrations = () => {
    api.get('/api/mcp/host/integrations', { headers: authHeaders() })
      .then((res) => setIntegrations(res.data || []))
      .catch(() => setIntegrations([]));
  };

  useEffect(() => { loadIntegrations(); }, []);

  const send = async (extra = {}) => {
    const text = extra.message || message;
    if (!text && !extra.run_id) return;
    setBusy(true);
    setError('');
    if (!extra.run_id) {
      setChat((rows) => [...rows, { role: 'admin', text }]);
      setMessage('');
    }
    try {
      const res = await api.post('/api/mcp/host/turn', {
        message: text,
        defense_level: Number(defenseLevel) || 0,
        lab_id: labId || undefined,
        ...extra,
      }, { headers: authHeaders() });
      setRun(res.data);
      if (res.data.answer) {
        setChat((rows) => [...rows, { role: 'assistant', text: res.data.answer }]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || 'The assistant could not complete that turn.');
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (serverId, enabled) => {
    const res = await api.post('/api/mcp/host/integrations', { server_id: serverId, enabled }, { headers: authHeaders() });
    setIntegrations(res.data || []);
  };

  const calls = (run?.steps || []).filter((step) => step.action && step.action !== 'finish');
  const server = (run?.servers || ['internal_shop'])[0];
  const tier = (integrations.find((row) => row.id === server) || {}).trust_tier || 'official';

  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1.4fr 0.8fr' }, gap: 2, p: 2, maxWidth: 1200, mx: 'auto' }}>
      <Paper sx={{ p: 2, minHeight: 480, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Admin assistant</Typography>
          <Chip size="small" label={labId} />
          <Chip
            size="small"
            variant="outlined"
            label={`${levelDetails?.shortLabel || `L${defenseLevel}`} ${levelDetails?.name || ''}`.trim()}
            sx={{ borderColor: levelDetails?.color, color: levelDetails?.color }}
          />
        </Box>
        <Typography sx={{ color: 'text.secondary', mb: 2 }}>
          This assistant is an MCP client connected to AIGoat&apos;s internal MCP server.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 1 }}>{String(error)}</Alert>}
        <Box sx={{ flex: 1 }}>
          {chat.map((row, index) => (
            <Typography key={`${row.role}-${index}`} sx={{ mb: 1 }}>
              <strong>{row.role === 'admin' ? 'You' : 'Assistant'}: </strong>{row.text}
            </Typography>
          ))}
        </Box>
        <Box component="form" onSubmit={(event) => { event.preventDefault(); send(); }} sx={{ display: 'flex', gap: 1 }}>
          <TextField fullWidth size="small" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Ask about open tickets" />
          <Button type="submit" variant="contained" disabled={busy}>Send</Button>
        </Box>
      </Paper>
      <Paper sx={{ p: 2, minWidth: 0, display: 'flex', flexDirection: 'column', maxHeight: { md: 'calc(100vh - 96px)' } }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Connected server</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
          <Chip label={server} />
          <Chip label={tier} variant="outlined" />
        </Box>
        {run?.impact && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            Hijack impact:
            {run.impact.order && ` order ${run.impact.order.id} ${run.impact.order.status};`}
            {run.impact.ticket && ` ticket ${run.impact.ticket.id} ${run.impact.ticket.status}.`}
            {' '}Reset the lab to restore.
          </Alert>
        )}
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Tool calls</Typography>
        <Box sx={{ flex: 1, minHeight: 0, overflow: 'auto', mb: 2 }}>
          {calls.length === 0 && <Typography sx={{ color: 'text.secondary' }}>None yet.</Typography>}
          {calls.map((step) => (
            <Box key={step.seq} sx={{ mb: 1.5, p: 1.25, border: '1px solid', borderColor: 'divider', borderRadius: 1, minWidth: 0 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', mb: 0.5 }}>
                <Typography sx={{ fontWeight: 700 }}>{step.action}</Typography>
                {step.decision && (
                  <Chip size="small" color={decisionColor(step.decision)} label={step.decision} />
                )}
                {step.control_id && <Chip size="small" variant="outlined" label={step.control_id} />}
              </Box>
              {step.arguments && Object.keys(step.arguments).length > 0 && (
                <Typography sx={{ fontFamily: 'monospace', fontSize: '0.75rem', mb: 0.5, wordBreak: 'break-word' }}>
                  {JSON.stringify(step.arguments)}
                </Typography>
              )}
              {step.observation && (
                <Typography
                  component="pre"
                  sx={{
                    m: 0,
                    p: 1,
                    maxHeight: 200,
                    overflow: 'auto',
                    whiteSpace: 'pre-wrap',
                    wordBreak: 'break-word',
                    fontFamily: 'monospace',
                    fontSize: '0.75rem',
                    bgcolor: 'action.hover',
                    borderRadius: 1,
                  }}
                >
                  {formatObservation(step.observation)}
                </Typography>
              )}
            </Box>
          ))}
        </Box>
        <Typography sx={{ fontWeight: 700, mt: 2 }}>Integrations</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.8rem', mb: 1 }}>
          Pre-registered add-ons only. Turning one on changes which server the next turn discovers.
        </Typography>
        {integrations.map((row) => (
          <FormControlLabel
            key={row.id}
            control={<Switch checked={!!row.enabled} disabled={row.locked} onChange={(e) => toggle(row.id, e.target.checked)} />}
            label={`${row.name} (${row.trust_tier})`}
          />
        ))}
      </Paper>
      <ApprovalDialog
        open={run?.status === 'awaiting_approval'}
        tool={run?.pending?.tool || ''}
        arguments={run?.pending?.arguments || {}}
        onApprove={() => send({ message: run?.answer || 'approve', run_id: run.run_id, decision: 'approve' })}
        onDeny={() => send({ message: run?.answer || 'deny', run_id: run.run_id, decision: 'deny' })}
      />
    </Box>
  );
};

export default AdminAssistantPage;
