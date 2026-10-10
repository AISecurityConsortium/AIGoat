import React, { useState } from 'react';
import {
  Box, Button, Chip, Tab, Tabs, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import { chipSx, inset, meta, mono, panel, quietButton, sectionTitle } from '../common/panelStyles';
import { fmtDateTime, sourceLabel } from './styles';

const STATUS_COLOR = { active: 'warning', cleared: 'default', quarantined: 'success' };

const Field = ({ label, children }) => (
  <>
    <Typography component="dt" sx={meta}>{label}</Typography>
    <Typography component="dd" sx={{ m: 0, fontSize: '0.8rem', minWidth: 0, wordBreak: 'break-word' }}>{children}</Typography>
  </>
);

const Fields = ({ children }) => (
  <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 1.5, rowGap: 0.25 }}>
    {children}
  </Box>
);

const Record = ({ id, title, chips, content, children }) => (
  <Box sx={{ ...inset, p: 1.25, borderColor: (t) => alpha(t.palette.warning.main, 0.4) }} role="listitem">
    <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
      <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{id}</Typography>
      <Typography sx={meta}>{title}</Typography>
      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', ml: 'auto' }}>{chips}</Box>
    </Box>
    <Box component="pre" sx={{ ...mono, fontSize: '0.74rem', m: 0, mb: 0.75, p: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word', borderRadius: '6px', bgcolor: (t) => alpha(t.palette.text.primary, 0.05) }}>
      {content}
    </Box>
    <Fields>{children}</Fields>
  </Box>
);

const Statuses = ({ row }) => (
  <>
    <Chip label={row.trust} size="small" variant="outlined" color={row.trust === 'untrusted' ? 'warning' : 'default'} sx={chipSx} />
    <Chip label={row.status} size="small" variant="outlined" color={STATUS_COLOR[row.status] || 'default'} sx={chipSx} />
  </>
);

const when = (value) => (value ? fmtDateTime(value) : 'never');

const Empty = ({ children }) => <Typography sx={meta}>{children}</Typography>;

/** Region: both memory stores, shown separately so the learner can watch poison move from one to the other. */
const MemoryInspector = ({ state, busy, onCleanup }) => {
  const [tab, setTab] = useState('connector');
  const { connector, agent, cache } = state.memory;
  const disabled = Boolean(busy);

  return (
    <Box component="section" aria-label="Memory inspector" sx={panel}>
      <Typography component="h2" sx={{ ...sectionTitle, mb: 0.25 }}>Memory inspector</Typography>
      <Typography sx={{ ...meta, mb: 1 }}>
        The MCP connector keeps what it extracted from sources. The agent copies from it into its own memory and reads that memory at the start of each request.
      </Typography>
      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Memory stores"
        sx={{ minHeight: 36, mb: 1.25, borderBottom: (t) => `1px solid ${t.palette.divider}`, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab value="connector" label={`Connector memory (${connector.length})`} />
        <Tab value="agent" label={`Agent memory (${agent.length})`} />
        <Tab value="cache" label={`Connector cache (${cache.length})`} />
      </Tabs>

      <Box role="list" aria-label={`${tab} records`} sx={{ display: 'grid', gap: 1, maxHeight: 360, overflowY: 'auto', pr: 0.25 }}>
        {tab === 'connector' && (connector.length === 0
          ? <Empty>The connector holds nothing. Submit a review or a ticket attachment and it will extract any hidden text here.</Empty>
          : connector.map((row) => (
            <Record key={row.id} id={`CM-${row.id}`} title={sourceLabel(row.source_type, row.source_id)} chips={<Statuses row={row} />} content={row.content}>
              <Field label="Source">{sourceLabel(row.source_type, row.source_id)}</Field>
              <Field label="Created">{when(row.created_at)}</Field>
              <Field label="Retrieved">{`${row.retrieval_count} times, last ${when(row.last_retrieved_at)}`}</Field>
              <Field label="Provenance">{Object.entries(row.provenance).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none recorded'}</Field>
            </Record>
          )))}
        {tab === 'agent' && (agent.length === 0
          ? <Empty>The agent has no memory of its own. It copies from the connector at its next request, so this can refill after you clear it.</Empty>
          : agent.map((row) => (
            <Record key={row.id} id={`AM-${row.id}`} title={`derived from CM-${row.connector_memory_id}`} chips={<Statuses row={row} />} content={row.content}>
              <Field label="Derived from">{`CM-${row.connector_memory_id}`}</Field>
              <Field label="Topics">{row.topics.join(', ') || 'none'}</Field>
              <Field label="Created">{when(row.created_at)}</Field>
              <Field label="Retrieved">{`${row.retrieval_count} times, last ${when(row.last_retrieved_at)}`}</Field>
              <Field label="Provenance">{Object.entries(row.provenance).map(([k, v]) => `${k}: ${v}`).join(', ') || 'none recorded'}</Field>
            </Record>
          )))}
        {tab === 'cache' && (cache.length === 0
          ? <Empty>The connector cache is empty. It remembers which sources were already extracted so they are not read twice.</Empty>
          : cache.map((row) => (
            <Box key={row.id} sx={{ ...inset, p: 1.25 }} role="listitem">
              <Fields>
                <Field label="Key">{row.cache_key}</Field>
                <Field label="Source">{sourceLabel(row.source_type, row.source_id)}</Field>
                <Field label="Extracted">{row.extracted ? 'yes, a memory was written' : 'no, nothing hidden'}</Field>
                <Field label="Hits">{row.hits}</Field>
              </Fields>
            </Box>
          )))}
      </Box>

      <Box sx={{ mt: 1.5, pt: 1.25, borderTop: (t) => `1px solid ${t.palette.divider}` }}>
        <Typography sx={{ ...meta, fontWeight: 700, mb: 0.75 }}>Cleanup, the realistic way and the reliable way</Typography>
        <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
          <Button variant="outlined" size="small" disabled={disabled} onClick={() => onCleanup('agent_memory')} sx={quietButton}>
            Clear agent memory
          </Button>
          <Button variant="outlined" size="small" disabled={disabled} onClick={() => onCleanup('connector_cache')} sx={quietButton}>
            Clear connector cache
          </Button>
          <Button variant="outlined" size="small" disabled={disabled} onClick={() => onCleanup('soft_reset')} sx={quietButton}>
            Soft reset
          </Button>
        </Box>
        <Typography sx={{ ...meta, mt: 0.75 }}>
          Each of these leaves a layer behind. Only the hard reset in the header restores the whole baseline.
        </Typography>
      </Box>
    </Box>
  );
};

export default MemoryInspector;
