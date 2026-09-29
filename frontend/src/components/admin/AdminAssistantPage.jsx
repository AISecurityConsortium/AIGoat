import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Button, Paper, TextField, Typography, Chip, Switch, FormControlLabel, Alert } from '@mui/material';
import { apiClient as api } from '../../config/api';
import ApprovalDialog from '../agent/ApprovalDialog';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const AdminAssistantPage = () => {
  const [params] = useSearchParams();
  const labId = params.get('lab') || '';
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
        defense_level: Number(localStorage.getItem('aigoat_defense_level') || 0),
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
        <Typography variant="h5" sx={{ fontWeight: 700 }}>Admin assistant</Typography>
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
      <Paper sx={{ p: 2 }}>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Connected server</Typography>
        <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
          <Chip label={server} />
          <Chip label={tier} variant="outlined" />
        </Box>
        <Typography sx={{ fontWeight: 700, mb: 1 }}>Tool calls</Typography>
        {calls.length === 0 && <Typography sx={{ color: 'text.secondary', mb: 2 }}>None yet.</Typography>}
        {calls.map((step) => (
          <Box key={step.seq} sx={{ mb: 1 }}>
            <Typography sx={{ fontWeight: 600 }}>{step.action}</Typography>
            <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary', whiteSpace: 'pre-wrap' }}>{step.observation}</Typography>
          </Box>
        ))}
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
