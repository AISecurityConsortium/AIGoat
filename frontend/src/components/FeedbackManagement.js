import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Avatar,
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
  ArrowBack as BackIcon,
  Search as SearchIcon,
} from '@mui/icons-material';
import { apiClient as api } from '../config/api';
import TicketThread, { threadOf } from './support/TicketThread';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const errorText = (err, fallback) => {
  const detail = err.response?.data?.detail;
  if (typeof detail === 'string' && detail) return detail;
  if (err.response?.status === 403) return 'Access denied. Admin privileges required.';
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
  return text.length > 80 ? `${text.slice(0, 80)}…` : text;
};

const waitingOnUs = (ticket) => {
  if (ticket.status !== 'open') return false;
  const last = threadOf(ticket).at(-1);
  return (last?.username || ticket.username) !== 'admin';
};

const FILTERS = [
  { id: 'open', label: 'Open' },
  { id: 'waiting', label: 'Waiting' },
  { id: 'closed', label: 'Closed' },
  { id: 'all', label: 'All' },
];

const FeedbackManagement = () => {
  const theme = useTheme();
  const narrow = useMediaQuery(theme.breakpoints.down('md'));
  const [tickets, setTickets] = useState([]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('open');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const picked = useRef(false);

  const load = useCallback(() => {
    api.get('/api/admin/support/tickets/', { headers: authHeaders() })
      .then((res) => {
        const rows = Array.isArray(res.data) ? res.data : [];
        setTickets(rows);
        setError('');
        setSelectedId((current) => {
          if (current && rows.some((row) => row.id === current)) return current;
          if (picked.current) return current;
          return (rows.find((row) => row.status === 'open') || rows[0] || {}).id ?? null;
        });
      })
      .catch((err) => {
        setTickets([]);
        setError(errorText(err, 'Could not load tickets.'));
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => ({
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    waiting: tickets.filter(waitingOnUs).length,
    closed: tickets.filter((ticket) => ticket.status === 'closed').length,
    all: tickets.length,
  }), [tickets]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (filter === 'open' && ticket.status !== 'open') return false;
      if (filter === 'closed' && ticket.status !== 'closed') return false;
      if (filter === 'waiting' && !waitingOnUs(ticket)) return false;
      if (!needle) return true;
      return `${ticket.username} ${ticket.subject} ${ticket.body} ${previewOf(ticket)}`.toLowerCase().includes(needle);
    });
  }, [tickets, query, filter]);

  const selected = tickets.find((ticket) => ticket.id === selectedId) || null;

  const openTicket = (id) => {
    picked.current = true;
    setSelectedId(id);
    setNotice('');
    setMobileDetail(true);
  };

  const reply = async (text) => {
    setError('');
    try {
      const res = await api.post(
        `/api/admin/support/tickets/${selected.id}/messages/`,
        { body: text },
        { headers: authHeaders() },
      );
      setTickets((rows) => rows.map((row) => (row.id === res.data.id ? res.data : row)));
    } catch (err) {
      setError(errorText(err, 'Could not send the reply.'));
      throw err;
    }
  };

  const setStatus = async (ticket, status) => {
    setError('');
    setNotice('');
    try {
      const res = await api.patch(
        `/api/admin/support/tickets/${ticket.id}/`,
        { status },
        { headers: authHeaders() },
      );
      setTickets((rows) => rows.map((row) => (row.id === ticket.id ? res.data : row)));
      setNotice(status === 'closed' ? 'Ticket closed. The shopper can still read it.' : 'Ticket reopened.');
    } catch (err) {
      setError(errorText(err, 'Could not update the ticket.'));
    }
  };

  const showList = !narrow || !mobileDetail;
  const showDetail = !narrow || mobileDetail;
  const shell = {
    border: 1,
    borderColor: 'divider',
    borderRadius: 3,
    bgcolor: 'background.paper',
    boxShadow: 'none',
    minHeight: { xs: 420, md: 480 },
    height: { md: 'calc(100vh - 280px)' },
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  };

  return (
    <Box sx={{ maxWidth: 1120, mx: 'auto', px: { xs: 2, md: 3 }, pt: { xs: 3, md: 4 }, pb: 5 }}>
      <Box sx={{ mb: 2 }}>
        <Typography sx={{ fontWeight: 800, fontSize: { xs: '1.6rem', md: '1.8rem' }, letterSpacing: '-0.03em' }}>
          Feedback
        </Typography>
        <Typography sx={{ color: 'text.secondary', mt: 0.5 }}>
          Shopper requests. Reply here, or close a ticket when it is resolved.
        </Typography>
      </Box>

      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
        {FILTERS.map((item) => (
          <Chip
            key={item.id}
            label={`${item.label} ${counts[item.id]}`}
            onClick={() => setFilter(item.id)}
            color={filter === item.id ? 'primary' : 'default'}
            variant={filter === item.id ? 'filled' : 'outlined'}
            sx={{ fontWeight: 700 }}
          />
        ))}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {notice && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setNotice('')}>{notice}</Alert>}

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '340px 1fr' }, gap: 2 }}>
        {showList && (
          <Box sx={shell}>
            <Box sx={{ p: 2, pb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <Typography sx={{ fontWeight: 700, mb: 1.25 }}>Inbox</Typography>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by shopper or subject"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                InputProps={{ startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary', fontSize: 20 }} /> }}
              />
            </Box>
            <Box sx={{ overflow: 'auto', flex: 1 }}>
              {loading && [0, 1, 2].map((row) => (
                <Box key={row} sx={{ px: 2, py: 1.5 }}>
                  <Skeleton width="40%" />
                  <Skeleton width="80%" />
                </Box>
              ))}
              {!loading && visible.length === 0 && (
                <Box sx={{ px: 2.5, py: 4 }}>
                  <Typography sx={{ fontWeight: 700, mb: 0.5 }}>Nothing in this queue</Typography>
                  <Typography sx={{ color: 'text.secondary', fontSize: '0.92rem' }}>
                    Try another filter, or wait for a shopper to write in.
                  </Typography>
                </Box>
              )}
              {visible.map((ticket) => {
                const active = ticket.id === selectedId;
                const needsReply = waitingOnUs(ticket);
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
                      display: 'flex',
                      gap: 1.25,
                      bgcolor: active ? (t) => alpha(t.palette.primary.main, 0.12) : 'transparent',
                      color: 'inherit',
                      font: 'inherit',
                      '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, active ? 0.14 : 0.06) },
                    }}
                  >
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: 'primary.main', flexShrink: 0 }}>
                      {(ticket.username || '?').slice(0, 1).toUpperCase()}
                    </Avatar>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
                        <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }} noWrap>{ticket.username}</Typography>
                        <Typography sx={{ fontSize: '0.75rem', color: 'text.secondary', flexShrink: 0 }}>
                          {relativeTime(ticket.created_at)}
                        </Typography>
                      </Box>
                      <Typography sx={{ fontWeight: 650, fontSize: '0.92rem' }} noWrap>{ticket.subject}</Typography>
                      <Typography sx={{ fontSize: '0.82rem', color: 'text.secondary', mb: 0.75 }} noWrap>
                        {previewOf(ticket)}
                      </Typography>
                      <Box sx={{ display: 'flex', gap: 0.75 }}>
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
                        {needsReply && (
                          <Chip size="small" label="Needs reply" color="primary" sx={{ height: 22, fontWeight: 700 }} />
                        )}
                      </Box>
                    </Box>
                  </Box>
                );
              })}
            </Box>
          </Box>
        )}

        {showDetail && (
          <Box sx={shell}>
            {!selected ? (
              <Box sx={{ p: 3 }}>
                <Typography sx={{ fontWeight: 700 }}>Select a request</Typography>
                <Typography sx={{ color: 'text.secondary' }}>The conversation opens here.</Typography>
              </Box>
            ) : (
              <>
                <Box sx={{ px: 2.5, py: 1.75, borderBottom: 1, borderColor: 'divider', display: 'flex', alignItems: 'flex-start', gap: 1, flexShrink: 0 }}>
                  {narrow && (
                    <IconButton aria-label="Back to inbox" onClick={() => setMobileDetail(false)} sx={{ mt: -0.5 }}>
                      <BackIcon />
                    </IconButton>
                  )}
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography sx={{ fontWeight: 800, fontSize: '1.15rem' }} noWrap>{selected.subject}</Typography>
                    <Typography sx={{ fontSize: '0.8rem', color: 'text.secondary' }}>
                      {selected.username} · Request #{selected.id} · {relativeTime(selected.created_at)}
                    </Typography>
                  </Box>
                  {selected.status === 'open' ? (
                    <Button size="small" variant="outlined" onClick={() => setStatus(selected, 'closed')}>
                      Close
                    </Button>
                  ) : (
                    <Button size="small" variant="outlined" onClick={() => setStatus(selected, 'open')}>
                      Reopen
                    </Button>
                  )}
                </Box>
                <TicketThread
                  ticket={selected}
                  canReply={selected.status === 'open'}
                  onReply={reply}
                  fill
                  closedNote="This ticket is closed. Reopen it to reply."
                />
              </>
            )}
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default FeedbackManagement;
