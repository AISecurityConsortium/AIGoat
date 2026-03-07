import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Container, Typography, Box, Grid, Card, CardContent, Chip, Button,
  TextField, Alert, CircularProgress, IconButton, Collapse,
  Switch, FormControlLabel, LinearProgress,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  EmojiEvents as TrophyIcon, Flag as FlagIcon,
  CheckCircle as CheckIcon, Star as StarIcon,
  PlayArrow as StartIcon,
  LightbulbOutlined as HintIcon,
  Lock as LockIcon, Send as SendIcon,
  ExpandMore as ExpandIcon, ExpandLess as CollapseIcon,
  Storage as KBIcon, ArrowBack as BackIcon,
  Security as ShieldIcon, Terminal as TerminalIcon,
} from '@mui/icons-material';
import { apiClient as axios } from '../config/api';
import { getApiUrl } from '../config/api';

const DIFF = {
  beginner:     { label: 'Beginner',     order: 0, hue: 'secondary' },
  intermediate: { label: 'Intermediate', order: 1, hue: 'warning'   },
  advanced:     { label: 'Advanced',     order: 2, hue: 'warning'   },
  expert:       { label: 'Expert',       order: 3, hue: 'error'     },
};

const KB_CHALLENGES = new Set([3, 7, 8]);

/* ── Chat widget ────────────────────────────────────────────────────── */

const ChallengeChat = ({ challengeId, started }) => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [useKB, setUseKB] = useState(false);
  const scrollRef = useRef(null);
  const needsKB = KB_CHALLENGES.has(challengeId);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const send = async () => {
    if (!input.trim() || sending || !started) return;
    const msg = input.trim();
    setInput('');
    setMessages(p => [...p, { role: 'user', content: msg }]);
    setSending(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        getApiUrl(`/api/challenges/${challengeId}/chat`),
        { message: msg, use_kb: needsKB && useKB },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setMessages(p => [...p, { role: 'assistant', content: res.data.reply, flag: res.data.flag || null }]);
    } catch (err) {
      setMessages(p => [...p, { role: 'error', content: err.response?.data?.detail || 'Request failed' }]);
    } finally {
      setSending(false);
    }
  };

  const surf = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)';
  const userBubble = alpha(theme.palette.primary.main, dark ? 0.18 : 0.1);
  const botBubble = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {needsKB && (
        <Box sx={{ px: 2, py: 0.75, bgcolor: surf, borderBottom: `1px solid ${theme.palette.divider}` }}>
          <FormControlLabel
            control={<Switch size="small" checked={useKB} onChange={e => setUseKB(e.target.checked)} />}
            label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}><KBIcon sx={{ fontSize: 15, opacity: 0.7 }} /><Typography sx={{ fontSize: '0.72rem', fontWeight: 500 }}>Knowledge Base</Typography></Box>}
          />
        </Box>
      )}

      <Box ref={scrollRef} sx={{ flex: 1, overflow: 'auto', px: 2, py: 1.5, display: 'flex', flexDirection: 'column', gap: 1.25, minHeight: 0 }}>
        {messages.length === 0 && (
          <Box sx={{ m: 'auto', textAlign: 'center', opacity: 0.45 }}>
            <TerminalIcon sx={{ fontSize: 36, mb: 1 }} />
            <Typography sx={{ fontSize: '0.82rem' }}>
              {started ? 'Type a message to begin your attack.' : 'Start the challenge to enable chat.'}
            </Typography>
          </Box>
        )}
        {messages.map((m, i) => (
          <Box key={i} sx={{
            alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '82%',
            bgcolor: m.role === 'user' ? userBubble : m.role === 'error' ? alpha(theme.palette.error.main, 0.1) : botBubble,
            borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
            px: 1.75, py: 1,
            border: m.flag ? `1px solid ${alpha(theme.palette.warning.main, 0.5)}` : 'none',
          }}>
            <Typography sx={{ fontSize: '0.82rem', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'text.primary' }}>
              {m.content}
            </Typography>
            {m.flag && (
              <Box sx={{ mt: 1, px: 1.25, py: 0.75, bgcolor: alpha(theme.palette.warning.main, 0.12), borderRadius: '8px', border: `1px solid ${alpha(theme.palette.warning.main, 0.25)}` }}>
                <Typography sx={{ fontSize: '0.72rem', fontWeight: 700, color: 'warning.main', fontFamily: 'monospace', letterSpacing: '0.02em' }}>
                  FLAG: {m.flag}
                </Typography>
              </Box>
            )}
          </Box>
        ))}
        {sending && (
          <Box sx={{ alignSelf: 'flex-start', display: 'flex', gap: 0.75, alignItems: 'center', px: 1.5, py: 0.75, bgcolor: botBubble, borderRadius: '12px' }}>
            <CircularProgress size={12} thickness={5} />
            <Typography sx={{ fontSize: '0.76rem', color: 'text.secondary' }}>Generating...</Typography>
          </Box>
        )}
      </Box>

      <Box sx={{ px: 2, py: 1.25, borderTop: `1px solid ${theme.palette.divider}`, display: 'flex', gap: 1, bgcolor: surf }}>
        <TextField
          fullWidth size="small" placeholder={started ? 'Type your attack...' : 'Start the challenge first'}
          value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          disabled={!started || sending} multiline maxRows={3}
          sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.84rem', borderRadius: '10px', bgcolor: dark ? 'rgba(0,0,0,0.25)' : '#fff', '& fieldset': { borderColor: theme.palette.divider } } }}
        />
        <IconButton onClick={send} disabled={!started || sending || !input.trim()} sx={{
          bgcolor: 'primary.main', color: '#fff', borderRadius: '10px', width: 38, height: 38, alignSelf: 'flex-end',
          '&:hover': { bgcolor: 'primary.dark' }, '&.Mui-disabled': { bgcolor: alpha(theme.palette.primary.main, 0.25), color: '#fff' },
        }}>
          <SendIcon sx={{ fontSize: 17 }} />
        </IconButton>
      </Box>
    </Box>
  );
};

/* ── Main page ──────────────────────────────────────────────────────── */

const ChallengePage = () => {
  const theme = useTheme();
  const dark = theme.palette.mode === 'dark';
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('All');
  const [active, setActive] = useState(null);
  const [flagInput, setFlagInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [feedback, setFeedback] = useState(null);
  const [hintsOpen, setHintsOpen] = useState(false);

  const headers = () => {
    const t = localStorage.getItem('token');
    return t ? { Authorization: `Bearer ${t}` } : {};
  };

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const r = await axios.get(getApiUrl('/api/workshop/challenges'), { headers: headers() });
      setChallenges(r.data);
      setError(null);
    } catch (e) {
      setError(e.response?.status === 401 ? 'Please log in to view challenges.' : 'Failed to load challenges.');
      setChallenges([]);
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const open = ch => { setActive(ch); setFlagInput(''); setFeedback(null); setHintsOpen(false); };
  const back = () => { setActive(null); setFeedback(null); load(); };

  const start = async () => {
    if (!active) return;
    setStarting(true); setFeedback(null);
    try {
      const r = await axios.post(getApiUrl(`/api/workshop/challenges/${active.id}/start`), {}, { headers: headers() });
      const u = { ...active, started: true, exploit_triggered: r.data.exploit_triggered || false };
      setActive(u); setChallenges(p => p.map(c => c.id === active.id ? u : c));
      setFeedback({ severity: 'info', message: 'Challenge started. Use the chat panel to attempt the exploit.' });
    } catch (e) {
      const d = e.response?.data?.detail || e.response?.data?.message || 'Failed';
      if (d.includes('already in progress')) {
        const u = { ...active, started: true };
        setActive(u); setChallenges(p => p.map(c => c.id === active.id ? u : c));
        setFeedback({ severity: 'info', message: 'Challenge in progress. Continue your attack.' });
      } else setFeedback({ severity: 'error', message: d });
    } finally { setStarting(false); }
  };

  const submitFlag = async () => {
    if (!active || !flagInput.trim()) return;
    setSubmitting(true); setFeedback(null);
    try {
      const r = await axios.post(getApiUrl(`/api/workshop/challenges/${active.id}/complete`), { flag: flagInput.trim() }, { headers: headers() });
      if (r.data.success) {
        setFeedback({ severity: 'success', message: `Challenge completed! +${r.data.points} points earned.` });
        const u = { ...active, completed: true };
        setActive(u); setChallenges(p => p.map(c => c.id === active.id ? u : c));
      }
    } catch (e) {
      setFeedback({ severity: 'error', message: e.response?.data?.detail || 'Invalid flag.' });
    } finally { setSubmitting(false); }
  };

  /* helper colors */
  const surface = theme.palette.custom?.surface?.elevated ?? (dark ? '#111318' : '#fff');
  const border = theme.palette.custom?.border?.subtle ?? theme.palette.divider;
  const muted = theme.palette.custom?.text?.muted ?? 'text.secondary';

  /* ── Loading ──────────────────────────────────────────────── */
  if (loading) return (
    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 'calc(100vh - 56px)' }}>
      <CircularProgress size={32} />
    </Box>
  );

  /* ── Challenge Detail View ────────────────────────────────── */
  if (active) {
    const d = DIFF[active.difficulty] || DIFF.beginner;
    const isKB = KB_CHALLENGES.has(active.id);

    return (
      <Box sx={{
        height: 'calc(100vh - 56px)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        bgcolor: 'background.default',
      }}>
        {/* ─ Top bar ─ */}
        <Box sx={{
          display: 'flex', alignItems: 'center', gap: 1.5,
          px: 3, py: 1.25,
          borderBottom: `1px solid ${border}`,
          bgcolor: surface,
          flexShrink: 0,
        }}>
          <IconButton size="small" onClick={back} sx={{ color: 'text.secondary', mr: 0.5 }}>
            <BackIcon fontSize="small" />
          </IconButton>
          <FlagIcon sx={{ color: 'primary.main', fontSize: 20 }} />
          <Typography sx={{ fontWeight: 700, fontSize: '0.95rem', color: 'text.primary', mr: 1 }}>
            {active.title}
          </Typography>
          <Chip label={active.owasp_ref} size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.light', fontSize: '0.65rem', fontWeight: 600, height: 20 }} />
          <Chip label={d.label} size="small" sx={{ bgcolor: alpha(theme.palette[d.hue].main, 0.1), color: `${d.hue}.main`, fontSize: '0.65rem', fontWeight: 600, height: 20 }} />
          <Chip icon={<StarIcon sx={{ fontSize: '0.75rem !important', color: 'warning.main !important' }} />} label={`${active.points}`} size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main', fontSize: '0.65rem', fontWeight: 600, height: 20 }} />
          {isKB && <Chip label="KB" size="small" sx={{ bgcolor: alpha(theme.palette.info.main, 0.1), color: 'info.main', fontSize: '0.62rem', fontWeight: 600, height: 20 }} />}
          <Box sx={{ flex: 1 }} />
          {active.completed && <Chip icon={<CheckIcon sx={{ fontSize: '0.85rem !important' }} />} label="Solved" size="small" sx={{ bgcolor: alpha(theme.palette.success.main, 0.1), color: 'success.main', fontWeight: 600, fontSize: '0.68rem', height: 22 }} />}
          {active.started && !active.completed && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box sx={{ width: 7, height: 7, borderRadius: '50%', bgcolor: 'secondary.main', boxShadow: `0 0 6px ${theme.palette.secondary.main}` }} />
              <Typography sx={{ fontSize: '0.7rem', color: 'secondary.main', fontWeight: 600 }}>Active</Typography>
            </Box>
          )}
        </Box>

        {/* ─ Body: two panels ─ */}
        <Box sx={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

          {/* Left — Instructions */}
          <Box sx={{
            width: '50%', flexShrink: 0,
            display: 'flex', flexDirection: 'column',
            borderRight: `1px solid ${border}`,
            overflow: 'hidden',
          }}>
            <Box sx={{ flex: 1, overflow: 'auto', px: 3, py: 2.5 }}>

              {/* Description */}
              <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: muted, mb: 1 }}>
                Objective
              </Typography>
              <Typography sx={{ fontSize: '0.86rem', lineHeight: 1.75, color: 'text.primary', mb: 2.5, whiteSpace: 'pre-line' }}>
                {active.description}
              </Typography>

              {/* Hints */}
              {active.hints?.length > 0 && (
                <Box sx={{ mb: 2.5 }}>
                  <Button size="small" startIcon={<HintIcon />} endIcon={hintsOpen ? <CollapseIcon /> : <ExpandIcon />}
                    onClick={() => setHintsOpen(!hintsOpen)}
                    sx={{ color: 'primary.light', textTransform: 'none', fontWeight: 600, fontSize: '0.76rem', mb: 0.5, px: 0 }}>
                    {hintsOpen ? 'Hide Hints' : 'Show Hints'}
                  </Button>
                  <Collapse in={hintsOpen}>
                    <Box sx={{ bgcolor: alpha(theme.palette.primary.main, 0.05), border: `1px solid ${alpha(theme.palette.primary.main, 0.12)}`, borderRadius: '10px', p: 1.5 }}>
                      {active.hints.map((h, i) => (
                        <Typography key={i} sx={{ fontSize: '0.8rem', color: 'primary.light', mb: i < active.hints.length - 1 ? 0.75 : 0, pl: 0.5, lineHeight: 1.6 }}>
                          {i + 1}. {h}
                        </Typography>
                      ))}
                    </Box>
                  </Collapse>
                </Box>
              )}

              {/* Status / Action */}
              <Box sx={{ borderTop: `1px solid ${border}`, pt: 2 }}>
                {active.completed ? (
                  <Alert severity="success" icon={<CheckIcon />} sx={{
                    borderRadius: '10px',
                    bgcolor: alpha(theme.palette.success.main, 0.08),
                    border: `1px solid ${alpha(theme.palette.success.main, 0.2)}`,
                    color: dark ? 'success.light' : 'success.dark',
                  }}>
                    Challenge solved! Points have been awarded.
                  </Alert>
                ) : !active.started ? (
                  <Box>
                    <Alert severity="info" icon={<LockIcon />} sx={{
                      mb: 2, borderRadius: '10px',
                      bgcolor: alpha(theme.palette.info.main, 0.06),
                      border: `1px solid ${alpha(theme.palette.info.main, 0.15)}`,
                      color: dark ? 'info.light' : 'info.dark',
                    }}>
                      Click Start to activate the challenge chat and begin tracking your progress.
                    </Alert>
                    <Button variant="contained" startIcon={<StartIcon />} onClick={start} disabled={starting} fullWidth
                      sx={{ textTransform: 'none', fontWeight: 700, borderRadius: '10px', py: 1.1, fontSize: '0.9rem' }}>
                      {starting ? 'Starting...' : 'Start Challenge'}
                    </Button>
                  </Box>
                ) : (
                  <Box>
                    {active.exploit_triggered && (
                      <Alert severity="warning" sx={{
                        mb: 2, borderRadius: '10px',
                        bgcolor: alpha(theme.palette.warning.main, 0.08),
                        border: `1px solid ${alpha(theme.palette.warning.main, 0.2)}`,
                        color: dark ? 'warning.light' : 'warning.dark',
                      }}>
                        Exploit triggered! Copy the flag from the chat response and paste it below.
                      </Alert>
                    )}
                    <Typography sx={{ fontSize: '0.68rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: muted, mb: 0.75 }}>
                      Submit Flag
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <TextField fullWidth size="small" placeholder="AIGOAT{...}"
                        value={flagInput} onChange={e => setFlagInput(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && submitFlag()}
                        sx={{ '& .MuiOutlinedInput-root': { fontSize: '0.84rem', fontFamily: 'monospace', borderRadius: '8px', bgcolor: dark ? 'rgba(0,0,0,0.25)' : '#fff', '& fieldset': { borderColor: border } } }}
                      />
                      <Button variant="contained" onClick={submitFlag} disabled={submitting || !flagInput.trim()}
                        sx={{ textTransform: 'none', fontWeight: 600, borderRadius: '8px', px: 2.5, whiteSpace: 'nowrap' }}>
                        {submitting ? '...' : 'Submit'}
                      </Button>
                    </Box>
                  </Box>
                )}
                {feedback && <Alert severity={feedback.severity} sx={{ mt: 2, borderRadius: '10px' }}>{feedback.message}</Alert>}
              </Box>
            </Box>
          </Box>

          {/* Right — Chat */}
          <Box sx={{ width: '50%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0 }}>
            <Box sx={{
              px: 2, py: 1,
              borderBottom: `1px solid ${border}`,
              bgcolor: surface,
              display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0,
            }}>
              <TerminalIcon sx={{ fontSize: 16, color: 'primary.main' }} />
              <Typography sx={{ fontWeight: 600, fontSize: '0.82rem', color: 'text.primary' }}>Challenge Chat</Typography>
            </Box>
            <ChallengeChat challengeId={active.id} started={active.started} />
          </Box>
        </Box>
      </Box>
    );
  }

  /* ── Challenge List View ──────────────────────────────────── */
  const filtered = challenges.filter(ch => {
    if (filter === 'Completed' && !ch.completed) return false;
    if (filter === 'Incomplete' && ch.completed) return false;
    if (!['All', 'Completed', 'Incomplete'].includes(filter) && ch.difficulty !== filter.toLowerCase()) return false;
    return true;
  });
  const groups = {};
  filtered.forEach(ch => { const d = ch.difficulty; if (!groups[d]) groups[d] = []; groups[d].push(ch); });
  const sortedGroups = Object.entries(groups).sort((a, b) => (DIFF[a[0]]?.order ?? 0) - (DIFF[b[0]]?.order ?? 0));

  const totalPts = challenges.reduce((s, c) => s + (c.completed ? c.points : 0), 0);
  const maxPts = challenges.reduce((s, c) => s + c.points, 0);
  const done = challenges.filter(c => c.completed).length;
  const pct = challenges.length ? Math.round((done / challenges.length) * 100) : 0;

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: 'calc(100vh - 56px)', py: 4 }}>
      <Container maxWidth="lg">
        {/* Header */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
          <ShieldIcon sx={{ fontSize: 32, color: 'primary.main' }} />
          <Typography variant="h4" sx={{ fontWeight: 800, color: 'text.primary', letterSpacing: '-0.02em' }}>
            Security Challenges
          </Typography>
        </Box>
        <Typography sx={{ color: muted, mb: 3.5, fontSize: '0.9rem', maxWidth: 600 }}>
          Exploit LLM vulnerabilities across 9 challenges. Each challenge has a dedicated chat environment — craft your attack, earn the flag, and submit it.
        </Typography>

        {error && <Alert severity="warning" sx={{ mb: 3, borderRadius: '10px' }}>{error}</Alert>}

        {/* Progress + Stats */}
        <Box sx={{
          display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap',
        }}>
          <Box sx={{ flex: 2, minWidth: 240, bgcolor: surface, border: `1px solid ${border}`, borderRadius: '14px', px: 3, py: 2.5 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5 }}>
              <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: muted }}>
                Progress
              </Typography>
              <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: 'text.primary' }}>{pct}%</Typography>
            </Box>
            <LinearProgress variant="determinate" value={pct} sx={{
              height: 6, borderRadius: 3, mb: 1.5,
              bgcolor: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
              '& .MuiLinearProgress-bar': { borderRadius: 3, bgcolor: 'primary.main' },
            }} />
            <Typography sx={{ fontSize: '0.75rem', color: muted }}>{done} of {challenges.length} completed</Typography>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120, bgcolor: surface, border: `1px solid ${border}`, borderRadius: '14px', px: 3, py: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: muted, mb: 0.5 }}>Points</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ color: 'warning.main', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{totalPts}</Typography>
              <Typography sx={{ color: muted, fontSize: '0.78rem', fontWeight: 500 }}>/ {maxPts}</Typography>
            </Box>
          </Box>
          <Box sx={{ flex: 1, minWidth: 120, bgcolor: surface, border: `1px solid ${border}`, borderRadius: '14px', px: 3, py: 2.5, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: muted, mb: 0.5 }}>Solved</Typography>
            <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.5 }}>
              <Typography sx={{ color: 'secondary.main', fontSize: '1.6rem', fontWeight: 800, lineHeight: 1 }}>{done}</Typography>
              <Typography sx={{ color: muted, fontSize: '0.78rem', fontWeight: 500 }}>/ {challenges.length}</Typography>
            </Box>
          </Box>
        </Box>

        {/* Filters */}
        <Box sx={{ display: 'flex', gap: 0.75, mb: 3.5, flexWrap: 'wrap' }}>
          {['All', 'Beginner', 'Intermediate', 'Expert', 'Completed', 'Incomplete'].map(f => (
            <Chip key={f} label={f} size="small" onClick={() => setFilter(f)} sx={{
              bgcolor: filter === f ? alpha(theme.palette.primary.main, 0.15) : 'transparent',
              color: filter === f ? 'primary.light' : muted,
              fontWeight: 600, fontSize: '0.74rem',
              border: `1px solid ${filter === f ? alpha(theme.palette.primary.main, 0.3) : border}`,
              '&:hover': { bgcolor: alpha(theme.palette.primary.main, 0.08) },
            }} />
          ))}
        </Box>

        {/* Challenge cards */}
        {sortedGroups.map(([difficulty, chs]) => {
          const dc = DIFF[difficulty] || DIFF.beginner;
          return (
            <Box key={difficulty} sx={{ mb: 4 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5 }}>
                <Chip label={dc.label} size="small" sx={{
                  bgcolor: alpha(theme.palette[dc.hue].main, 0.1),
                  color: `${dc.hue}.main`,
                  fontWeight: 700, fontSize: '0.7rem',
                  border: `1px solid ${alpha(theme.palette[dc.hue].main, 0.2)}`,
                }} />
                <Typography sx={{ color: muted, fontSize: '0.76rem' }}>
                  {chs.length} challenge{chs.length !== 1 ? 's' : ''}
                </Typography>
              </Box>
              <Grid container spacing={2}>
                {chs.map(ch => {
                  const cd = DIFF[ch.difficulty] || DIFF.beginner;
                  return (
                    <Grid item xs={12} sm={6} md={4} key={ch.id}>
                      <Card onClick={() => open(ch)} sx={{
                        bgcolor: surface, cursor: 'pointer', height: '100%', position: 'relative',
                        border: ch.completed
                          ? `1px solid ${alpha(theme.palette.success.main, 0.25)}`
                          : `1px solid ${border}`,
                        borderRadius: '14px', transition: 'all 0.2s ease',
                        overflow: 'hidden',
                        '&:hover': {
                          borderColor: alpha(theme.palette[cd.hue].main, 0.4),
                          transform: 'translateY(-3px)',
                          boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, dark ? 0.4 : 0.12)}`,
                        },
                        '&::before': {
                          content: '""', position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                          bgcolor: ch.completed ? 'success.main' : theme.palette[cd.hue].main,
                          opacity: ch.completed ? 0.6 : 0.4,
                        },
                      }}>
                        <CardContent sx={{ p: 2.5, pb: '20px !important' }}>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                            <Box sx={{ display: 'flex', gap: 0.5 }}>
                              <Chip label={ch.owasp_ref} size="small" sx={{ bgcolor: alpha(theme.palette.primary.main, 0.1), color: 'primary.light', fontSize: '0.64rem', fontWeight: 600, height: 20 }} />
                              {KB_CHALLENGES.has(ch.id) && (
                                <Chip label="KB" size="small" sx={{ bgcolor: alpha(theme.palette.warning.main, 0.1), color: 'warning.main', fontSize: '0.6rem', fontWeight: 600, height: 20 }} />
                              )}
                            </Box>
                            {ch.completed && <CheckIcon sx={{ color: 'success.main', fontSize: '1.15rem' }} />}
                          </Box>
                          <Typography sx={{ color: 'text.primary', fontWeight: 700, fontSize: '0.95rem', mb: 0.75, lineHeight: 1.3 }}>
                            {ch.title}
                          </Typography>
                          <Typography sx={{
                            color: muted, fontSize: '0.78rem', mb: 2, lineHeight: 1.55,
                            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                          }}>
                            {ch.description}
                          </Typography>
                          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Chip label={cd.label} size="small" sx={{
                              bgcolor: alpha(theme.palette[cd.hue].main, 0.1),
                              color: `${cd.hue}.main`,
                              fontSize: '0.62rem', fontWeight: 600, height: 18,
                            }} />
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.4 }}>
                              <StarIcon sx={{ fontSize: '0.85rem', color: 'warning.main' }} />
                              <Typography sx={{ color: 'warning.main', fontWeight: 700, fontSize: '0.8rem' }}>{ch.points}</Typography>
                            </Box>
                          </Box>
                        </CardContent>
                      </Card>
                    </Grid>
                  );
                })}
              </Grid>
            </Box>
          );
        })}

        {filtered.length === 0 && !error && (
          <Box sx={{ textAlign: 'center', py: 8, opacity: 0.5 }}>
            <TrophyIcon sx={{ fontSize: 48, mb: 1 }} />
            <Typography sx={{ fontSize: '1rem' }}>No challenges match your filter.</Typography>
          </Box>
        )}
      </Container>
    </Box>
  );
};

export default ChallengePage;
