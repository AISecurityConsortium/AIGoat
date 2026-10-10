import React, { useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, MenuItem, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import SendIcon from '@mui/icons-material/Send';
import { chipSx, inset, meta, panel, sectionTitle } from '../common/panelStyles';
import ApprovalPanel from './ApprovalPanel';

const FALLBACK_ACTIONS = [
  { id: 'tickets_today', label: "Today's Ticket Summary", prompt: 'Summarize the support tickets received today.' },
  { id: 'tickets_open', label: 'Unresolved Ticket Count', prompt: 'How many support tickets still need resolution?' },
  { id: 'low_rated', label: 'Low-Rated Products', prompt: 'Which products have the lowest customer ratings?' },
  { id: 'checkout_price', label: 'Product Price / Checkout Check', prompt: 'Check the current checkout price for this product.' },
];

const DECISION_COLOR = { allow: 'success', deny: 'error', require_approval: 'warning' };
const DECISION_LABEL = { allow: 'ran', deny: 'denied', require_approval: 'held for approval' };

/** Quick actions fill the box and nothing else. The learner still presses Send. */
export const promptFor = (action, product) => (
  action.id === 'checkout_price' && product
    ? `Check the current checkout price for ${product.name} (${product.sku}).`
    : action.prompt
);

/** Regions C and D: the agent conversation, quick actions, tool steps and approvals. */
const AgentPanel = ({
  state, busy, lastRun, examples, models, product, onSend, onDecide,
}) => {
  const [text, setText] = useState('');
  const [model, setModel] = useState('');
  const pane = useRef(null);
  const actions = examples?.quick_actions?.length ? examples.quick_actions : FALLBACK_ACTIONS;
  const chosen = state.products.find((p) => p.sku === product);
  const pending = state.approvals.some((a) => a.status === 'pending');
  const working = busy === 'turn' || busy === 'decision';
  const conversation = state.conversation || [];

  useEffect(() => {
    if (pane.current) pane.current.scrollTop = pane.current.scrollHeight;
  }, [conversation.length, working]);

  const send = async (event) => {
    event.preventDefault();
    const message = text.trim();
    if (!message) return;
    setText('');
    await onSend(message, model);
  };

  return (
    <Box component="section" aria-label="Agent interaction" sx={{ ...panel, p: 2, display: 'grid', gap: 1.5 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={sectionTitle}>Agentic Cracky, shop operations agent</Typography>
        <Box sx={{ flex: 1 }} />
        <TextField
          select
          size="small"
          label="Model"
          value={model}
          onChange={(e) => setModel(e.target.value)}
          disabled={working}
          sx={{ minWidth: 190 }}
          helperText={models.available ? undefined : 'Ollama did not list models. The default is used.'}
        >
          <MenuItem value="">{`Default${models.default ? ` (${models.default})` : ''}`}</MenuItem>
          {models.models.map((name) => <MenuItem key={name} value={name}>{name}</MenuItem>)}
        </TextField>
      </Box>

      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }} role="group" aria-label="Quick actions">
        <Typography sx={meta}>Quick actions fill the box:</Typography>
        {actions.map((action) => (
          <Button
            key={action.id}
            size="small"
            variant="outlined"
            onClick={() => setText(promptFor(action, chosen))}
            sx={{ textTransform: 'none', fontSize: '0.78rem' }}
          >
            {action.label}
          </Button>
        ))}
      </Box>

      <Box
        sx={{
          ...inset,
          display: 'grid',
          overflow: 'hidden',
        }}
      >
        <Box
          ref={pane}
          role="log"
          aria-label="Conversation"
          aria-live="polite"
          sx={{
            minHeight: { xs: 300, md: 460 },
            height: { xs: 'min(420px, 52vh)', md: 'min(560px, 62vh)' },
            overflowY: 'auto',
            px: { xs: 1.5, md: 2 },
            py: 1.75,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
          }}
        >
          {conversation.length === 0 && !working && (
            <Box sx={{ m: 'auto', textAlign: 'center', maxWidth: 360, py: 4 }}>
              <Typography sx={{ fontSize: '1rem', fontWeight: 600, mb: 0.5 }}>No conversation yet</Typography>
              <Typography sx={{ ...meta, fontSize: '0.9rem' }}>
                Use a quick action or ask in your own words. The agent reply appears here in full.
              </Typography>
            </Box>
          )}
          {conversation.map((message, index) => {
            const fromUser = message.role === 'user';
            return (
              <Box
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                sx={{
                  alignSelf: fromUser ? 'flex-end' : 'stretch',
                  maxWidth: fromUser ? '88%' : '100%',
                  px: 2,
                  py: 1.5,
                  borderRadius: fromUser ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  bgcolor: (t) => (fromUser
                    ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.22 : 0.12)
                    : alpha(t.palette.text.primary, t.palette.mode === 'dark' ? 0.08 : 0.04)),
                  border: (t) => (fromUser ? 'none' : `1px solid ${t.palette.divider}`),
                }}
              >
                <Typography sx={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: fromUser ? 'primary.light' : 'text.secondary', mb: 0.75 }}>
                  {fromUser ? 'You' : 'Agentic Cracky'}
                </Typography>
                <Typography sx={{ fontSize: '1.05rem', lineHeight: 1.7, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {message.content}
                </Typography>
              </Box>
            );
          })}
          {working && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, px: 0.5 }} role="status">
              <CircularProgress size={18} />
              <Typography sx={{ fontSize: '0.95rem', color: 'text.secondary' }}>
                The agent is working. Watch the execution trace.
              </Typography>
            </Box>
          )}
        </Box>

        {lastRun && lastRun.steps?.length > 0 && (
          <Box
            sx={{
              display: 'flex',
              gap: 0.75,
              flexWrap: 'wrap',
              alignItems: 'center',
              px: 1.5,
              py: 1,
              borderTop: (t) => `1px solid ${t.palette.divider}`,
            }}
            aria-label="Tools used in the last run"
          >
            <Typography sx={{ ...meta, fontWeight: 600 }}>Last run used:</Typography>
            {lastRun.steps.map((step, index) => (
              <Chip
                // eslint-disable-next-line react/no-array-index-key
                key={index}
                size="small"
                variant="outlined"
                color={DECISION_COLOR[step.decision] || 'default'}
                label={`${step.tool} ${DECISION_LABEL[step.decision] || step.decision}`}
                sx={chipSx}
              />
            ))}
          </Box>
        )}

        <Box
          component="form"
          onSubmit={send}
          sx={{
            display: 'grid',
            gap: 1,
            px: 1.5,
            py: 1.25,
            borderTop: (t) => `1px solid ${t.palette.divider}`,
            bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.12 : 0.03),
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'stretch' }}>
            <TextField
              fullWidth
              label="Ask the agent"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  if (!working && !pending && text.trim()) send(event);
                }
              }}
              disabled={working || pending}
              multiline
              minRows={2}
              maxRows={8}
              inputProps={{ maxLength: 1000 }}
              sx={{ '& .MuiInputBase-root': { fontSize: '1rem', lineHeight: 1.65, alignItems: 'flex-start' } }}
            />
            <Button
              type="submit"
              variant="contained"
              disabled={working || pending || !text.trim()}
              endIcon={<SendIcon />}
              sx={{ textTransform: 'none', fontWeight: 700, whiteSpace: 'nowrap', minWidth: 108, px: 2.25 }}
            >
              Send
            </Button>
          </Box>
          <Typography sx={meta}>
            {pending
              ? 'An approval is waiting. Approve or reject it before sending another request.'
              : 'Enter to send, Shift+Enter for a new line.'}
          </Typography>
        </Box>
      </Box>

      {lastRun?.status === 'completed_without_agent' && (
        <Alert severity="info">{lastRun.note}</Alert>
      )}

      <ApprovalPanel approvals={state.approvals} busy={busy} onDecide={onDecide} />
    </Box>
  );
};

export default AgentPanel;
