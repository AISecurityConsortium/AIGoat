import React, {
  useEffect, useMemo, useRef, useState,
} from 'react';
import PropTypes from 'prop-types';
import {
  Alert, Box, Button, Checkbox, FormControlLabel, Radio, TextField, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { apiClient } from '../../config/api';
import API_CONFIG from '../../config/api';
import { REASON } from '../labs/LabGuide';

const MONO = 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
const REDACTED = '[redacted]';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const KIND_LABEL = {
  tool_result: 'tools/call result',
  control_decision: 'client control',
  discover: 'server/discover',
  planner_simulated: 'planner simulation',
  tools_listed: 'tools/list',
  tool_call: 'tools/call',
};

const cleanExcerpt = (text) => String(text || '')
  .replace(/^\{"text": \["/, '')
  .replace(/\\n/g, ' ')
  .replace(/\\"/g, '"')
  .replace(/\s+/g, ' ')
  .trim();

const argsText = (args) => Object.entries(args || {})
  .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
  .join(', ');

const McpEvidenceSubmit = ({ lab, events, labelForId, onEvaluation }) => {
  const config = lab?.ui?.submission || {};
  const picker = Boolean(config.evidence);
  const evidence = config.evidence || {};
  const fields = config.fields || {};
  const kinds = useMemo(() => new Set(evidence.kinds || []), [evidence.kinds]);
  const candidates = useMemo(
    () => [...(events || [])].filter((event) => kinds.has(event.kind)).reverse(),
    [events, kinds],
  );
  const [picked, setPicked] = useState('');
  const [values, setValues] = useState({});
  const [redacted, setRedacted] = useState({});
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failure, setFailure] = useState('');
  const feedbackRef = useRef(null);

  useEffect(() => {
    if (feedback && feedbackRef.current) feedbackRef.current.scrollIntoView({ block: 'nearest' });
  }, [feedback]);

  const setValue = (name, value) => {
    setFeedback('');
    setValues((prev) => ({ ...prev, [name]: value }));
  };
  const complete = (!picker || Boolean(picked))
    && Object.keys(fields).every((name) => String(values[name] || '').trim());

  const submit = async () => {
    setBusy(true);
    setFeedback('');
    setFailure('');
    try {
      const { data } = await apiClient.post(
        API_CONFIG.ENDPOINTS.LAB_SUBMIT(lab.id),
        { fields: picker ? { evidence: String(picked), ...values } : values },
        { headers: authHeaders() },
      );
      const met = Boolean(data.evaluation?.exploit_triggered);
      if (!met) setFeedback(data.guidance || REASON[data.evaluation?.reason_code] || 'That evidence does not support this conclusion.');
      if (onEvaluation) onEvaluation(data.evaluation || null, data.takeaway || {});
    } catch (err) {
      setFailure(err.response?.data?.detail || err.message || 'Submission failed');
    } finally {
      setBusy(false);
    }
  };

  const label = { fontWeight: 700, fontSize: '0.8rem', mb: 0.5 };
  const meta = { fontSize: '0.75rem', color: 'text.secondary', lineHeight: 1.4 };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
      {config.help && <Typography sx={meta}>{config.help}</Typography>}
      {picker && (
      <Box>
        <Typography sx={label}>{evidence.label || 'Evidence'}</Typography>
        {!candidates.length && (
          <Typography sx={meta}>{evidence.empty || 'Nothing recorded yet. Investigate first.'}</Typography>
        )}
        {candidates.length > 0 && (
          <Box role="radiogroup" aria-label={evidence.label || 'Evidence'} sx={{ display: 'flex', flexDirection: 'column', gap: 0.5, maxHeight: 216, overflowY: 'auto', pr: 0.25 }}>
            {candidates.map((event) => {
              const active = String(event.seq) === String(picked);
              const choose = () => { setPicked(String(event.seq)); setFeedback(''); };
              const detail = argsText(event.args);
              return (
                <Box
                  key={event.seq}
                  role="radio"
                  aria-checked={active}
                  tabIndex={0}
                  onClick={choose}
                  onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(); } }}
                  sx={{
                    display: 'flex',
                    gap: 0.75,
                    alignItems: 'flex-start',
                    px: 0.75,
                    py: 0.6,
                    borderRadius: '8px',
                    cursor: 'pointer',
                    flexShrink: 0,
                    border: (t) => `1px solid ${active ? t.palette.primary.main : t.palette.divider}`,
                    bgcolor: (t) => (active ? alpha(t.palette.primary.main, 0.1) : 'transparent'),
                    '&:hover': { borderColor: 'primary.main' },
                    '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: 1 },
                  }}
                >
                  <Radio size="small" checked={active} tabIndex={-1} sx={{ p: 0.25, mt: -0.1 }} inputProps={{ 'aria-hidden': true }} />
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'baseline', gap: 0.75, minWidth: 0 }}>
                      <Typography noWrap sx={{ fontFamily: event.tool ? MONO : 'inherit', fontSize: '0.8rem', fontWeight: 700, minWidth: 0 }}>
                        {event.tool || labelForId(event.server_id)}
                      </Typography>
                      {event.decision && (
                        <Typography sx={{ fontSize: '0.72rem', color: 'text.secondary', flexShrink: 0 }}>{event.decision}</Typography>
                      )}
                    </Box>
                    <Typography sx={{ ...meta, fontSize: '0.72rem', wordBreak: 'break-word' }}>
                      <Box component="span" sx={{ fontFamily: MONO }}>{KIND_LABEL[event.kind] || event.kind}</Box>
                      {[
                        event.tool ? labelForId(event.server_id) : '',
                        detail,
                        event.kind === 'discover' && event.claimed_name ? `reports name ${event.claimed_name}` : '',
                      ].filter(Boolean).map((part) => ` · ${part}`).join('')}
                    </Typography>
                    {cleanExcerpt(event.excerpt) && cleanExcerpt(event.excerpt) !== '{}' && (
                      <Typography
                        sx={{
                          fontFamily: MONO,
                          fontSize: '0.7rem',
                          lineHeight: 1.45,
                          color: 'text.secondary',
                          mt: 0.25,
                          wordBreak: 'break-all',
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {cleanExcerpt(event.excerpt)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              );
            })}
          </Box>
        )}
      </Box>
      )}

      {Object.entries(fields).map(([name, spec]) => {
        const choices = Array.isArray(spec?.choices) ? spec.choices : null;
        if (choices) {
          return (
            <Box key={name} role="radiogroup" aria-label={spec.label || name}>
              <Typography sx={label}>{spec.label || name}</Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.25 }}>
                {choices.map((choice) => (
                  <FormControlLabel
                    key={choice.id}
                    sx={{ alignItems: 'flex-start', mx: 0, '& .MuiFormControlLabel-label': { fontSize: '0.8rem', lineHeight: 1.4, pt: 0.35 } }}
                    control={(
                      <Radio
                        size="small"
                        checked={values[name] === choice.id}
                        onChange={() => setValue(name, choice.id)}
                        sx={{ p: 0.5 }}
                      />
                    )}
                    label={choice.label}
                  />
                ))}
              </Box>
            </Box>
          );
        }
        return (
          <Box key={name}>
            <Typography sx={label}>{spec?.label || name}</Typography>
            <TextField
              fullWidth
              size="small"
              disabled={Boolean(redacted[name])}
              placeholder={spec?.placeholder || ''}
              value={redacted[name] ? '' : (values[name] || '')}
              onChange={(event) => setValue(name, event.target.value)}
              inputProps={{ 'aria-label': spec?.label || name, spellCheck: false, style: { fontFamily: MONO, fontSize: '0.8rem' } }}
            />
            {spec?.redacted_label && (
              <FormControlLabel
                sx={{ mx: 0, mt: 0.25, '& .MuiFormControlLabel-label': { fontSize: '0.75rem', color: 'text.secondary' } }}
                control={(
                  <Checkbox
                    size="small"
                    checked={Boolean(redacted[name])}
                    onChange={(event) => {
                      setRedacted((prev) => ({ ...prev, [name]: event.target.checked }));
                      setValue(name, event.target.checked ? REDACTED : '');
                    }}
                    sx={{ p: 0.5 }}
                  />
                )}
                label={spec.redacted_label}
              />
            )}
          </Box>
        );
      })}

      <Box sx={{ position: 'sticky', bottom: 0, bgcolor: 'background.paper', pt: 0.5, pb: 1.5, mt: -0.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        <Button fullWidth variant="contained" disabled={busy || !complete} onClick={submit} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Submit evidence
        </Button>
        {feedback && (
          <Alert ref={feedbackRef} severity="warning" sx={{ py: 0.25, '& .MuiAlert-message': { fontSize: '0.78rem' } }}>{feedback}</Alert>
        )}
        {failure && <Alert severity="error" sx={{ py: 0.25 }}>{String(failure)}</Alert>}
      </Box>
    </Box>
  );
};

McpEvidenceSubmit.propTypes = {
  lab: PropTypes.shape({
    id: PropTypes.string,
    ui: PropTypes.object,
  }).isRequired,
  events: PropTypes.arrayOf(PropTypes.object),
  labelForId: PropTypes.func.isRequired,
  onEvaluation: PropTypes.func,
};

export default McpEvidenceSubmit;
