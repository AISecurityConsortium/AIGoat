import React, { useEffect, useRef, useState } from 'react';
import { Avatar, Box, IconButton, TextField, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { AttachFile as AttachFileIcon, Send as SendIcon } from '@mui/icons-material';
import { apiClient as api } from '../../config/api';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const formatWhen = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const initials = (name) => (name || '?').slice(0, 1).toUpperCase();

export const threadOf = (ticket) => {
  if (!ticket) return [];
  if (ticket.messages && ticket.messages.length) return ticket.messages;
  return [{
    id: `opening-${ticket.id}`,
    username: ticket.username,
    body: ticket.body,
    created_at: ticket.created_at,
  }];
};

export const downloadAttachment = async (ticketId, messageId, name) => {
  const res = await api.get(
    `/api/support/tickets/${ticketId}/messages/${messageId}/file`,
    { headers: authHeaders(), responseType: 'blob' },
  );
  const url = URL.createObjectURL(res.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = name || 'attachment';
  link.click();
  URL.revokeObjectURL(url);
};

const TicketThread = ({
  ticket,
  canReply,
  onReply,
  fill = false,
  supportUsernames = [],
  closedNote = 'This request is closed. Start a new request if you still need help.',
}) => {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef(null);
  const viewer = localStorage.getItem('username') || '';
  const messages = threadOf(ticket);

  useEffect(() => {
    const node = scroller.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [ticket?.id, messages.length]);

  const send = async (event) => {
    event.preventDefault();
    if (!draft.trim() || sending) return;
    setSending(true);
    try {
      await onReply(draft.trim());
      setDraft('');
    } catch {
      // The page shows the error banner.
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      send(event);
    }
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      flex: fill ? 1 : undefined,
    }}
    >
      <Box
        ref={scroller}
        sx={{
          flex: fill ? 1 : undefined,
          maxHeight: fill ? undefined : 360,
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 1.5,
          px: fill ? 2.5 : 0,
          py: fill ? 2 : 0,
          mb: fill ? 0 : 2,
        }}
      >
        {messages.map((message) => {
          const mine = message.username === viewer;
          const label = mine
            ? 'You'
            : (supportUsernames.includes(message.username) ? 'AI Goat Support' : message.username);
          return (
            <Box key={message.id} sx={{ display: 'flex', justifyContent: mine ? 'flex-end' : 'flex-start', gap: 1 }}>
              {!mine && (
                <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main' }}>
                  {initials(label)}
                </Avatar>
              )}
              <Box sx={{ maxWidth: 'min(78%, 520px)' }}>
                <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', mb: 0.4, textAlign: mine ? 'right' : 'left' }}>
                  {label} · {formatWhen(message.created_at)}
                </Typography>
                <Box sx={{
                  px: 1.5,
                  py: 1.1,
                  borderRadius: mine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                  bgcolor: (t) => (mine ? alpha(t.palette.primary.main, 0.14) : (t.palette.custom?.surface?.elevated || t.palette.action.hover)),
                  border: (t) => `1px solid ${mine ? alpha(t.palette.primary.main, 0.28) : t.palette.divider}`,
                }}
                >
                  <Typography sx={{ whiteSpace: 'pre-wrap', fontSize: '0.95rem' }}>{message.body}</Typography>
                  {message.attachment_name && (
                    <Box
                      component="button"
                      type="button"
                      onClick={() => downloadAttachment(ticket.id, message.id, message.attachment_name)}
                      sx={{
                        mt: 1,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0.5,
                        border: 0,
                        cursor: 'pointer',
                        borderRadius: 999,
                        px: 1,
                        py: 0.4,
                        bgcolor: 'background.paper',
                        color: 'primary.main',
                        font: 'inherit',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                      }}
                    >
                      <AttachFileIcon sx={{ fontSize: 16 }} />
                      {message.attachment_name}
                    </Box>
                  )}
                </Box>
              </Box>
            </Box>
          );
        })}
      </Box>
      <Box sx={{ px: fill ? 2.5 : 0, pb: fill ? 2 : 0, pt: fill ? 1.5 : 0, borderTop: fill ? 1 : 0, borderColor: 'divider' }}>
        {canReply ? (
          <Box component="form" onSubmit={send} sx={{ display: 'flex', gap: 1, alignItems: 'flex-end' }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              size="small"
              placeholder="Write a reply"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
            />
            <IconButton type="submit" color="primary" disabled={sending || !draft.trim()} aria-label="Send reply">
              <SendIcon />
            </IconButton>
          </Box>
        ) : (
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', py: 0.5 }}>
            {closedNote}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default TicketThread;
