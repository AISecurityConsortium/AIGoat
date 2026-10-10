import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Chip, FormControlLabel, Switch, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { chipSx, inset, meta, mono, panel, sectionTitle } from '../common/panelStyles';
import { eventTone, fmtTime, toneBg } from './styles';

const Evidence = ({ event }) => (
  <Box sx={{ ...inset, p: 1.25 }} aria-label="Event evidence">
    <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{event.title}</Typography>
    <Typography sx={{ ...meta, ...mono, mb: 0.75 }}>
      {`event ${event.id}, ${event.kind}, ${event.status}, run ${event.op_id}`}
    </Typography>
    <Box component="pre" sx={{ ...mono, fontSize: '0.74rem', m: 0, p: 1, borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 260, overflow: 'auto', bgcolor: (t) => alpha(t.palette.text.primary, 0.05) }}>
      {JSON.stringify({ detail: event.detail, refs: event.refs }, null, 2)}
    </Box>
  </Box>
);

/** Live execution trace. Every row is one backend event, none is invented by the page. */
const TracePanel = ({ events, busy }) => {
  const [selected, setSelected] = useState(0);
  const [latestOnly, setLatestOnly] = useState(false);
  const list = useRef(null);

  const shown = useMemo(() => {
    if (!latestOnly || events.length === 0) return events;
    const last = events[events.length - 1].op_id;
    return events.filter((e) => e.op_id === last);
  }, [events, latestOnly]);

  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight;
  }, [shown.length]);

  const current = shown.find((e) => e.id === selected) || null;
  const select = (id) => setSelected((now) => (now === id ? 0 : id));

  return (
    <Box component="section" aria-label="Execution trace" sx={{ ...panel, display: 'grid', gap: 1 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
        <Typography component="h2" sx={sectionTitle}>Execution trace</Typography>
        {busy === 'turn' || busy === 'decision' ? <Chip label="Live" size="small" color="info" sx={chipSx} /> : null}
        <Box sx={{ flex: 1 }} />
        <FormControlLabel
          control={<Switch size="small" checked={latestOnly} onChange={(e) => setLatestOnly(e.target.checked)} />}
          label={<Typography sx={meta}>Latest action only</Typography>}
          sx={{ m: 0 }}
        />
      </Box>
      <Box
        ref={list}
        role="list"
        aria-label="Trace events"
        sx={{ ...inset, maxHeight: 380, overflowY: 'auto', display: 'grid', alignContent: 'start' }}
      >
        {shown.length === 0 && (
          <Typography sx={{ ...meta, p: 1.5 }}>
            Nothing has happened yet. Submit a source or ask the agent something, and each step shows up here as it happens.
          </Typography>
        )}
        {shown.map((event) => {
          const tone = eventTone(event);
          const active = event.id === selected;
          return (
            <Box
              key={event.id}
              role="listitem"
              sx={{ borderBottom: (t) => `1px solid ${t.palette.divider}`, '&:last-of-type': { borderBottom: 0 } }}
            >
              <Box
                component="button"
                type="button"
                onClick={() => select(event.id)}
                aria-pressed={active}
                aria-label={`${tone.label}: ${event.title}`}
                sx={{
                  all: 'unset',
                  boxSizing: 'border-box',
                  width: '100%',
                  display: 'flex',
                  gap: 1,
                  alignItems: 'flex-start',
                  px: 1.25,
                  py: 0.75,
                  cursor: 'pointer',
                  bgcolor: (t) => (active ? toneBg(t, tone.color) : 'transparent'),
                  borderLeft: (t) => `4px solid ${tone.color === 'default' ? t.palette.divider : t.palette[tone.color].main}`,
                  '&:hover': { bgcolor: (t) => toneBg(t, tone.color) },
                  '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 },
                }}
              >
                <Typography sx={{ ...meta, ...mono, flexShrink: 0, pt: 0.1 }}>{fmtTime(event.created_at)}</Typography>
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography sx={{ fontSize: '0.82rem', fontWeight: tone.strong ? 700 : 500, wordBreak: 'break-word' }}>{event.title}</Typography>
                </Box>
                <Chip label={tone.label} size="small" color={tone.color} variant={tone.strong ? 'filled' : 'outlined'} sx={{ ...chipSx, flexShrink: 0 }} />
              </Box>
            </Box>
          );
        })}
      </Box>
      {current ? <Evidence event={current} /> : (
        shown.length > 0 && <Typography sx={meta}>Select an event to see the evidence behind it.</Typography>
      )}
    </Box>
  );
};

export default TracePanel;
