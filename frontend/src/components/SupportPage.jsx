import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Skeleton,
  TextField,
  Typography,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  Add as AddIcon,
  ArrowBack as BackIcon,
  AttachFile as AttachFileIcon,
  Close as CloseIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { apiClient as api } from '../config/api';
import TicketThread, { threadOf } from './support/TicketThread';

const TOPICS = [
  { label: 'Order status', subject: 'Where is my order?' },
  { label: 'Damaged item', subject: 'Something arrived damaged' },
  { label: 'Returns', subject: 'I would like to return an item' },
];

const MAX_FILE = 2 * 1024 * 1024;

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const errorText = (err, fallback) => {
  const detail = err.response?.data?.detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => item.msg || String(item)).join(' ');
  }
  if (typeof detail === 'string' && detail) return detail;
  return fallback;
};

const relativeTime = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const mins = Math.round((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const previewOf = (ticket) => {
  const last = threadOf(ticket).at(-1);
  const text = (last?.body || ticket.body || '').replace(/\s+/g, ' ').trim();
  return text.length > 72 ? `${text.slice(0, 72)}…` : text;
};

const SupportPage = () => {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [file, setFile] = useState(null);
  const fileInput = useRef(null);
  const [tickets, setTickets] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [composing, setComposing] = useState(false);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileDetail, setMobileDetail] = useState(false);
  const picked = useRef(false);

  const load = useCallback(() => {
    api.get('/api/support/tickets/', { headers: authHeaders() })
      .then((res) => {
        const rows = res.data || [];
        setTickets(rows);
        setSelectedId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          if (picked.current) return current;
          return rows[0]?.id ?? null;
        });
      })
      .catch((err) => {
        setTickets([]);
        setError(errorText(err, 'Could not load your requests.'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) || null;
  const openCount = tickets.filter((ticket) => ticket.status === 'open').length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter !== 'all' && ticket.status !== filter) return false;
      if (!needle) return true;
      return `${ticket.subject} ${ticket.body} ${previewOf(ticket)}`.toLowerCase().includes(needle);
    });
  }, [tickets, query, filter]);

  const startRequest = (nextSubject = '') => {
    picked.current = true;
    setComposing(true);
    setSelectedId(null);
    setSubject(nextSubject);
    setNotice('');
    setError('');
    setMobileDetail(true);
  };

  const openTicket = (id) => {
    picked.current = true;
    setComposing(false);
    setSelectedId(id);
    setNotice('');
    setMobileDetail(true);
  };

  const showList = !narrow || !mobileDetail;
  const showDetail = !narrow || mobileDetail;

  const onFile = (event) => {
    const next = event.target.files?.[0] || null;
    if (next && next.size > MAX_FILE) {
      setError('Attachment must be 2 MB or smaller.');
      event.target.value = '';
      setFile(null);
      return;
    }
    setError('');
    setFile(next);
  };

  const clearFile = () => {
    setFile(null);
    if (fileInput.current) fileInput.current.value = '';
  };

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');
    setSending(true);
    try {
      const data = new FormData();
      data.append('subject', subject);
      data.append('body', body);
      if (file) data.append('file', file);
      const res = await api.post('/api/support/tickets/', data, { headers: authHeaders() });
      setSubject('');
      setBody('');
      clearFile();
      setNotice('Request sent. We will reply in this thread.');
      picked.current = true;
      setComposing(false);
      setSelectedId(res.data.id);
      setMobileDetail(true);
      setTickets((rows) => [res.data, ...rows.filter((row) => row.id !== res.data.id)]);
    } catch (err) {
      setError(errorText(err, 'Could not send the request.'));
    } finally {
      setSending(false);
    }
  };

  const reply = async (text) => {
    setError('');
    try {
      const res = await api.post(
        `/api/support/tickets/${selectedId}/messages/`,
        { body: text },
        { headers: authHeaders() },
      );
      setTickets((rows) => rows.map((row) => (row.id === res.data.id ? res.data : row)));
    } catch (err) {
      setError(errorText(err, 'Could not send the reply.'));
      throw err;
    }
  };

  const shell = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 3,
    bgcolor: 'background.paper',
    boxShadow: 'none',
    minHeight: { xs: 420, md: 480 },
    height: { md: 'calc(100vh - 300px)' },
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2, md: 3 }, pt: { xs: 3, md: 4 }, pb: 5 }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 2 }}>
        <Box>
          <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '1.8rem' }, letterSpacing: '-0.03em' }}>
            Support
          </Typography>
          <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
            Questions about an order, a delivery, or a product. We reply in this thread.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => startRequest()} sx={{ flexShrink: 0 }}>
          New request
        </Button>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {TOPICS.map((topic) => (
          <Chip
            key={topic.label}
            label={topic.label}
            onClick={() => startRequest(topic.subject)}
            variant="outlined"
            sx={{ fontWeight: 600 }}
          />
        ))}
        <Typography sx={{ alignSelf: 'center', fontSize: '0.85rem', color: 'text.secondary', ml: { md: 1 } }}>
          {openCount} open
        </Typography>
      </Box>

      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '320px 1fr' }, gap: 2, alignItems: 'stretch' }}>
        {showList && (
          <Box sx={shell}>
            <Box sx={{ p: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, mb: 1.25 }}>Your requests</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Search requests"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
              />
              <Box sx={{ display: 'flex', gap: 0.75, mt: 1.25 }}>
                {['all', 'open', 'closed'].map((key) => (
                  <Chip
                    key={key}
                    label={key === 'all' ? 'All' : key[0].toUpperCase() + key.slice(1)}
                    size="small"
                    onClick={() => setFilter(key)}
                    color={filter === key ? 'primary' : 'default'}
                    variant={filter === key ? 'filled' : 'outlined'}
                    sx={{ fontWeight: 600 }}
                  />
                ))}
              </Box>
            </Box>
            <Box sx={{ overflow: 'auto', flex: 1 }}>
              {loading && [0, 1, 2].map((row) => (
                <Box key={row} sx={{ px: 2, py: 1.5 }}>
                  <Skeleton width="70%" />
                  <Skeleton width="90%" />
                </Box>
              ))}
              {!loading && visible.length === 0 && (
                <Box sx={{ px: 2.5, py: 4 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>No requests yet</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.92rem' }}>
                    Tell us what happened and the reply will show up here.
                  </Typography>
                </Box>
              )}
              {visible.map((ticket) => {
                const active = !composing && ticket.id === selectedId;
                return (
                  <Box
                    key={ticket.id}
                    component="button"
                    type="button"
                    onClick={() => openTicket(ticket.id)}
                    sx={{
                      width: '100%',
                      textAlign: 'left',
                      border: 0,
                      borderBottom: '1px solid',
                      borderBottomColor: 'divider',
                      borderLeft: '3px solid',
                      borderLeftColor: active ? 'primary.main' : 'transparent',
                      cursor: 'pointer',
                      px: 2,
                      py: 1.5,
                      bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.12) : 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, active ? 0.14 : 0.06) },
                    }}
                  >
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1, mb: 0.25 }}>
                      <Typography sx={{ fontWeight: 700, fontSize: '0.95rem' }} noWrap>{ticket.subject}</Typography>
                      <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', flexShrink: 0 }}>
                        {relativeTime(ticket.created_at)}
                      </Typography>
                    </Box>
                    <Typography sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: 0.75 }} noWrap>
                      {previewOf(ticket)}
                    </Typography>
                    <Chip
                      size="small"
                      label={ticket.status === 'open' ? 'Open' : 'Closed'}
                      sx={{
                        height: 22,
                        fontWeight: 700,
                        bgcolor: (t) => alpha(ticket.status === 'open' ? t.palette.warning.main : t.palette.text.secondary, 0.14),
                        color: ticket.status === 'open' ? 'warning.main' : 'text.secondary',
                      }}
                    />
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {showDetail && (
          <Box sx={shell}>
            {composing || !selected ? (
              <Box component="form" onSubmit={submit} sx={{ p: { xs: 2, md: 3 }, overflow: 'auto' }}>
                {narrow && (
                  <Button startIcon={<BackIcon />} onClick={() => setMobileDetail(false)} sx={{ mb: 1, ml: -1 }}>
                    Requests
                  </Button>
                )}
                <Typography sx={{ fontWeight: 800, fontSize: '1.35rem', letterSpacing: '-0.02em', mb: 0.5 }}>
                  How can we help?
                </Typography>
                <Typography sx={{ color: 'text.secondary', mb: 2.5 }}>
                  Include the order number if you have one. A photo or note can be attached.
                </Typography>
                <TextField
                  fullWidth
                  label="Subject"
                  value={subject}
                  onChange={(event) => setSubject(event.target.value)}
                  sx={{ mb: 2 }}
                  required
                />
                <TextField
                  fullWidth
                  multiline
                  minRows={7}
                  label="Message"
                  value={body}
                  onChange={(event) => setBody(event.target.value)}
                  sx={{ mb: 2 }}
                  required
                />
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
                  <Box
                    component="label"
                    sx={{
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1.5,
                      p: 1.5,
                      borderRadius: 2,
                      border: '1.5px dashed',
                      borderColor: file ? 'primary.main' : 'divider',
                      cursor: 'pointer',
                      '&:hover': { borderColor: 'primary.main', bgcolor: (t) => alpha(t.palette.primary.main, 0.04) },
                    }}
                  >
                    <AttachFileIcon color={file ? 'primary' : 'action'} />
                    <Box sx={{ minWidth: 0 }}>
                      <Typography sx={{ fontWeight: 600 }} noWrap>{file ? file.name : 'Attach a file'}</Typography>
                      <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>Optional. Up to 2 MB.</Typography>
                    </Box>
                    <input hidden ref={fileInput} type="file" onChange={onFile} />
                  </Box>
                  {file && (
                    <IconButton size="small" aria-label="Remove attachment" onClick={clearFile}>
                      <CloseIcon fontSize="small" />
                    </IconButton>
                  )}
                </Box>
                <Button type="submit" variant="contained" disabled={sending}>
                  {sending ? 'Sending…' : 'Send request'}
                </Button>
              </Box>
            ) : (
              <>
                <Box sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1, flexShrink: 0 }}>
                  {narrow && (
                    <IconButton aria-label="Back to requests" onClick={() => setMobileDetail(false)} sx={{ mt: -0.5 }}>
                      <BackIcon />
                    </IconButton>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }} noWrap>{selected.subject}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      Request #{selected.id}
                    </Typography>
                  </Box>
                  <Chip
                    size="small"
                    label={selected.status === 'open' ? 'Open' : 'Closed'}
                    sx={{
                      fontWeight: 700,
                      bgcolor: (t) => alpha(selected.status === 'open' ? t.palette.warning.main : t.palette.text.secondary, 0.14),
                      color: selected.status === 'open' ? 'warning.main' : 'text.secondary',
                    }}
                  />
                </Box>
                <TicketThread
                  ticket={selected}
                  canReply={selected.status === 'open'}
                  onReply={reply}
                  fill
                  supportUsernames={['admin']}
                />
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default SupportPage;
