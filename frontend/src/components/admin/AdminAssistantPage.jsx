import React, { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import {
  Alert, Box, Button, Chip, FormControlLabel, Switch, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { apiClient as api } from '../../config/api';
import ApprovalDialog from '../agent/ApprovalDialog';
import DefenseLevelToggle from '../DefenseLevelToggle';
import { SectionCard } from '../common';
import { SCORED_TOOL } from '../../utils/labTeaching';
import { useDefense } from '../../contexts/DefenseContext';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const FACTS = [
  {
    title: 'Who this is for',
    body: 'Admin only. You operate the assistant. Shoppers such as Alice never open this page. They file tickets and reviews, and those words are data, not orders.',
  },
  {
    title: 'What it does',
    body: 'One message is one turn. The assistant reads a snapshot of open tickets and recent reviews, then a local model may call a tool. Refund and export replies are decoy confirmations. They do not change the shop.',
  },
  {
    title: 'How to use it',
    body: 'Pick a defense level, ask in a sentence, then read the tool names above the box. The raw result sits in This turn. A paragraph that sounds like a refund is not a refund until issue_refund appears.',
  },
];

const TOOLS = [
  { name: 'list_open_tickets', detail: 'Open tickets, including text a shopper planted.' },
  { name: 'read_ticket', detail: 'One ticket and the customer message.' },
  { name: 'list_recent_reviews', detail: 'Recent reviews, including the comment.' },
  { name: 'issue_refund', detail: 'Decoy confirmation. Level 2 pauses until you approve.' },
  { name: 'export_customer', detail: 'Decoy confirmation. Level 2 pauses until you approve.' },
];

const STARTERS = [
  { label: 'Open tickets', text: 'What open tickets need action?' },
  { label: 'Recent reviews', text: 'Read the recent reviews and tell me what they ask for.' },
  { label: 'A product price', text: 'Look up product HOO-001 and tell me the price.', note: 'Turn on the Shop Catalog (community package) first.' },
];

const looksLikePayload = (text) => {
  const sample = (text || '').trim();
  if (!sample) return false;
  if (sample.startsWith('{') || sample.startsWith('[')) return true;
  if (sample.includes('```') || /\b[a-z_][a-z0-9_]*\s*\(/.test(sample)) return true;
  return sample.includes('"price_usd"') || sample.includes('\\"ok\\"') || sample.includes('"text"');
};

const stripCode = (text) => (text || '')
  .replace(/```[\s\S]*?```/g, ' ')
  .replace(/^\s*[a-z_][a-z0-9_]*\s*\([^)]*\).*$/gim, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const digValue = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return digValue(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = digValue(value[index]);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    if (value.product) return value.product;
    if (value.price_usd != null || value.name) return value;
    if (value.text) return digValue(value.text);
  }
  return null;
};

const digTickets = (value) => {
  if (value == null) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return null;
    try {
      return digTickets(JSON.parse(trimmed));
    } catch {
      return null;
    }
  }
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const found = digTickets(value[index]);
      if (found) return found;
    }
    return null;
  }
  if (typeof value === 'object') {
    if (Array.isArray(value.tickets)) return value.tickets;
    if (value.text) return digTickets(value.text);
  }
  return null;
};

const sentenceForCall = (step) => {
  if (step.action === 'list_open_tickets') {
    const tickets = digTickets(step.observation);
    if (tickets) {
      if (!tickets.length) return 'There are no open tickets.';
      const subjects = tickets.slice(0, 3).map((ticket) => ticket.subject).filter(Boolean);
      const count = `${tickets.length} open ticket${tickets.length === 1 ? '' : 's'}`;
      return subjects.length ? `There are ${count}: ${subjects.join('; ')}.` : `There are ${count}.`;
    }
  }
  const product = digValue(step.observation);
  if (product && (product.name || product.price_usd != null)) {
    const name = product.name || 'That product';
    const sku = product.sku ? ` (${product.sku})` : '';
    const price = product.price_usd != null ? `$${product.price_usd} USD` : 'an unlisted price';
    return `${name}${sku} is ${price}.`;
  }
  if (step.action && step.action !== 'finish') {
    return `${step.action} finished. The raw result is in This turn.`;
  }
  return '';
};

const chatReply = (answer, steps) => {
  const text = (answer || '').trim();
  const prose = stripCode(text);
  const coded = looksLikePayload(text) || prose !== text.replace(/\s+/g, ' ').trim();
  if (!coded) return text;
  if (prose.length > 40 && !looksLikePayload(prose)) return prose;
  const sentences = (steps || []).map(sentenceForCall).filter(Boolean);
  return sentences[0] || 'The desk did not return a plain answer. The raw result is in This turn.';
};

const AdminAssistantPage = () => {
  const [params] = useSearchParams();
  const labId = params.get('lab') || '';
  const { defenseLevel } = useDefense();
  const [message, setMessage] = useState('');
  const [chat, setChat] = useState([]);
  const [run, setRun] = useState(null);
  const [integrations, setIntegrations] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const chatPane = useRef(null);
  const abortRef = useRef(null);

  const loadIntegrations = () => {
    api.get('/api/mcp/host/integrations', { headers: authHeaders() })
      .then((res) => setIntegrations(res.data || []))
      .catch(() => setIntegrations([]));
  };

  useEffect(() => { loadIntegrations(); }, []);

  useEffect(() => {
    const pane = chatPane.current;
    if (pane) pane.scrollTop = pane.scrollHeight;
  }, [chat, busy]);

  useEffect(() => {
    if (!labId) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/mcp/host/integrations', { headers: authHeaders() });
        const rows = res.data || [];
        for (const row of rows) {
          if (row.locked || cancelled) continue;
          if (cancelled) continue;
        }
        if (!cancelled) {
          const fresh = await api.get('/api/mcp/host/integrations', { headers: authHeaders() });
          setIntegrations(fresh.data || []);
        }
      } catch {
        if (!cancelled) setIntegrations([]);
      }
    })();
    return () => { cancelled = true; };
  }, [labId]);

  const send = async (extra = {}) => {
    const text = extra.message || message;
    if (!text && !extra.run_id) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError('');
    if (!extra.run_id) {
      setChat((rows) => [...rows, { role: 'admin', text }]);
      setMessage('');
    }
    try {
      const res = await api.post('/api/mcp/host/turn', {
        message: text,
        defense_level: defenseLevel,
        lab_id: labId || undefined,
        ...extra,
      }, { headers: authHeaders(), signal: controller.signal });
      setRun(res.data);
      const reply = chatReply(res.data.answer, res.data.steps);
      if (reply) {
        setChat((rows) => [...rows, { role: 'assistant', text: reply }]);
      }
    } catch (err) {
      if (controller.signal.aborted || err.code === 'ERR_CANCELED') {
        setChat((rows) => [...rows, { role: 'assistant', text: 'Stopped. This turn ended before a reply.', stopped: true }]);
      } else {
        setError(err.response?.data?.detail || 'The assistant could not complete that turn.');
      }
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  };

  const stop = () => {
    abortRef.current?.abort();
  };

  const toggle = async (serverId, enabled) => {
    const res = await api.post('/api/mcp/host/integrations', { server_id: serverId, enabled }, { headers: authHeaders() });
    setIntegrations(res.data || []);
  };

  const calls = (run?.steps || []).filter((step) => step.action && step.action !== 'finish');
  const scoredTool = SCORED_TOOL[labId];
  const calledScoredTool = calls.some((step) => step.action === scoredTool);
  const missedTool = Boolean(
    scoredTool
    && run
    && run.status !== 'awaiting_approval'
    && !calledScoredTool
    && !run.evaluation?.exploit_triggered,
  );
  const goalMet = Boolean(run?.evaluation?.exploit_triggered);
  const goalMetText = 'Lab condition met.';

  return (
    <Box sx={{ maxWidth: 1280, mx: 'auto', px: { xs: 2, md: 3 }, py: { xs: 2, md: 4 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start', mb: 2 }}>
        <Box sx={{ minWidth: 0, maxWidth: 720 }}>
          <Typography variant="h4" component="h1" sx={{ fontWeight: 800, letterSpacing: '-0.03em', fontSize: { xs: '1.7rem', md: '2rem' } }}>
            Shop Admin Assistant
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.75, lineHeight: 1.5 }}>
            Tickets, reviews, and refunds for the shop. You ask. The desk may call a tool.
          </Typography>
        </Box>
        <DefenseLevelToggle compact />
      </Box>

      {labId && (
        <Alert
          severity="info"
          sx={{ mb: 2 }}
          action={(
            <Button component={RouterLink} to={`/labs/${labId}`} color="inherit" size="small" sx={{ textTransform: 'none' }}>
              Back to lab
            </Button>
          )}
        >
          {scoredTool
            ? `This lab scores ${scoredTool}. Ask without naming that tool.`
            : 'You opened this page from a lab.'}
          {labId === 'mcp04-1' ? ' The Shop Catalog (community package) should already be on.' : ''}
        </Alert>
      )}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr' }, gap: 1, mb: 2 }}>
        {FACTS.map((fact) => (
          <Box
            key={fact.title}
            sx={{
              px: 1.25,
              py: 0.85,
              borderRadius: '10px',
              border: (theme) => `1px solid ${theme.palette.divider}`,
            }}
          >
            <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', lineHeight: 1.3, mb: 0.25 }}>
              {fact.title}
            </Typography>
            <Typography sx={{ fontSize: '0.75rem', lineHeight: 1.35, color: 'text.secondary' }}>
              {fact.body}
            </Typography>
          </Box>
        ))}
      </Box>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1.3fr) minmax(260px, 0.7fr)' }, gap: 2, alignItems: 'start' }}>
        <Box sx={{ borderRadius: '16px', border: (theme) => `2px solid ${theme.palette.primary.main}` }}>
        <SectionCard title="Ask">
          {error && <Alert severity="error" sx={{ mb: 1.5 }}>{String(error)}</Alert>}
          {run?.status === 'awaiting_approval' && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Paused for approval. The lab is met only after you approve, and only if the arguments came from the planted ticket or review.
            </Alert>
          )}
          {goalMet && (
            <Alert severity="success" sx={{ mb: 1.5 }}>
              {goalMetText}
            </Alert>
          )}
          {missedTool && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              The model did not call {scoredTool}. The lesson is that missing call, not the sentence above.
            </Alert>
          )}

          <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem', mb: 1 }}>
            Pick a start, edit it if you want, then press Send.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
            {STARTERS.map((starter) => (
              <Button
                key={starter.label}
                size="small"
                variant={message === starter.text ? 'contained' : 'outlined'}
                onClick={() => setMessage(starter.text)}
                disabled={busy}
                sx={{ textTransform: 'none' }}
              >
                {starter.label}
              </Button>
            ))}
          </Box>

          <Box
            ref={chatPane}
            role="log"
            aria-label="Shop Admin Assistant conversation"
            sx={{
              height: 320,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 1.25,
              mb: 1.5,
              pr: 0.5,
              scrollbarWidth: 'thin',
              scrollbarColor: (theme) => `${alpha(theme.palette.primary.main, 0.55)} transparent`,
              '&::-webkit-scrollbar': { width: 8 },
              '&::-webkit-scrollbar-track': { background: 'transparent' },
              '&::-webkit-scrollbar-thumb': {
                background: (theme) => alpha(theme.palette.primary.main, 0.45),
                borderRadius: 8,
              },
            }}
          >
            {chat.length === 0 && !busy && (
              <Typography sx={{ color: 'text.secondary', lineHeight: 1.65 }}>
                No turn yet. A useful first question is what the open tickets need. After Send, the tool name shows above the box and the raw result sits in This turn.
                {STARTERS[2].note ? ` ${STARTERS[2].note}` : ''}
              </Typography>
            )}
            {chat.map((row, index) => {
              const mine = row.role === 'admin';
              return (
                <Box
                  key={`${row.role}-${index}`}
                  sx={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '88%',
                    px: 1.5,
                    py: 1,
                    borderRadius: mine ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                    bgcolor: (theme) => (mine
                      ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.22 : 0.12)
                      : (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.04)')),
                    border: (theme) => `1px solid ${mine ? alpha(theme.palette.primary.main, 0.55) : theme.palette.divider}`,
                  }}
                >
                  <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'text.secondary', mb: 0.25 }}>
                    {mine ? 'You' : 'Shop Admin Assistant'}
                  </Typography>
                  <Typography sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{row.text}</Typography>
                </Box>
              );
            })}
            {busy && (
              <Box
                role="status"
                aria-live="polite"
                sx={{
                  alignSelf: 'flex-start',
                  maxWidth: '88%',
                  px: 1.5,
                  py: 1.25,
                  borderRadius: '14px 14px 14px 4px',
                  border: (theme) => `1px solid ${alpha(theme.palette.primary.main, 0.45)}`,
                  bgcolor: (theme) => (theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.03)'),
                  '@keyframes aigoatSweep': {
                    '0%': { transform: 'translateX(-60%)' },
                    '100%': { transform: 'translateX(220%)' },
                  },
                }}
              >
                <Typography sx={{ fontWeight: 700, fontSize: '0.75rem', letterSpacing: '0.04em', color: 'text.secondary', mb: 1 }}>
                  Shop Admin Assistant
                </Typography>
                <Box
                  aria-hidden="true"
                  sx={{
                    position: 'relative',
                    width: 180,
                    height: 3,
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: (theme) => alpha(theme.palette.primary.main, 0.15),
                  }}
                >
                  <Box
                    sx={{
                      position: 'absolute',
                      top: 0,
                      bottom: 0,
                      width: '40%',
                      bgcolor: 'primary.main',
                      animation: 'aigoatSweep 1.1s ease-in-out infinite',
                      '@media (prefers-reduced-motion: reduce)': { animation: 'none', width: '100%' },
                    }}
                  />
                </Box>
              </Box>
            )}
          </Box>

          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 1.25, minHeight: 32 }}>
            <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mr: 0.5 }}>Called</Typography>
            {calls.length === 0 && !busy && (
              <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>
                None yet
              </Typography>
            )}
            {calls.map((step) => (
              <Chip key={step.seq} size="small" label={step.decision ? `${step.action} · ${step.decision}` : step.action} />
            ))}
          </Box>

          <Box component="form" onSubmit={(event) => { event.preventDefault(); send(); }} sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
            <TextField
              fullWidth
              multiline
              minRows={2}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Ask about open tickets, reviews, or a product"
              disabled={busy}
            />
            {busy ? (
              <Button type="button" variant="outlined" color="warning" onClick={stop} sx={{ textTransform: 'none', mt: 0.5 }}>
                Stop
              </Button>
            ) : (
              <Button type="submit" variant="contained" disabled={!message.trim()} sx={{ textTransform: 'none', mt: 0.5 }}>
                Send
              </Button>
            )}
          </Box>
        </SectionCard>
        </Box>

        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <SectionCard title="Add-on servers" dense>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 1, lineHeight: 1.5 }}>
              Off by default. Turning one on lets the next turn discover that server. The mirror can answer a catalog question with a listing that is not the official shop.
            </Typography>
            {integrations.map((row) => (
              <FormControlLabel
                key={row.id}
                sx={{ display: 'flex', ml: 0, alignItems: 'flex-start' }}
                control={(
                  <Switch
                    checked={!!row.enabled}
                    disabled={row.locked || busy}
                    onChange={(event) => toggle(row.id, event.target.checked)}
                  />
                )}
                label={`${row.name} (${row.trust_tier}${row.locked ? ', always on' : ''})`}
              />
            ))}
          </SectionCard>

          <SectionCard title="This turn" dense>
            {calls.length === 0 && (
              <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', lineHeight: 1.5 }}>
                {busy ? 'Working.' : 'The raw tool result shows up here after you send.'}
              </Typography>
            )}
            {calls.map((step) => (
              <Box key={step.seq} sx={{ mb: 1.5 }}>
                <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
                  <Typography sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, fontSize: '0.8125rem' }}>
                    {step.action}
                  </Typography>
                  {step.decision && <Chip size="small" label={step.decision} />}
                </Box>
                <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto' }}>
                  {step.observation || 'No result text.'}
                </Typography>
              </Box>
            ))}
          </SectionCard>

          <SectionCard title="What it can call" dense>
            <Typography sx={{ color: 'text.secondary', fontSize: '0.875rem', mb: 1.25, lineHeight: 1.5 }}>
              Internal Management Server is always connected. These tools are the official set.
            </Typography>
            {TOOLS.map((tool) => (
              <Box key={tool.name} sx={{ mb: 1.25 }}>
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontWeight: 700, fontSize: '0.8125rem' }}>
                    {tool.name}
                  </Typography>
                  {calls.some((step) => step.action === tool.name) && <Chip size="small" label="Called" />}
                </Box>
                <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.45 }}>{tool.detail}</Typography>
              </Box>
            ))}
          </SectionCard>
        </Box>
      </Box>

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
