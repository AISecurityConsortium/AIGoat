import React from 'react';
import PropTypes from 'prop-types';
import { Alert, Box, Button, Chip, Switch, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import Disclosure from '../common/Disclosure';
import McpDefenseBehaviour from '../mcp/McpDefenseBehaviour';
import {
  chipSx, meta, mono, panel, quietButton, sectionTitle,
} from './ragStyles';

const IntegrationPanel = ({ enabled, onToggle }) => (
  <Box
    sx={{
      ...panel,
      borderColor: (t) => (enabled ? alpha(t.palette.success.main, 0.5) : t.palette.divider),
      bgcolor: (t) => (enabled ? alpha(t.palette.success.main, 0.05) : t.palette.background.paper),
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
      <Typography sx={sectionTitle} component="h2" id="rag-integration-title">Cracky integration</Typography>
      <Box sx={{ flex: 1 }} />
      <Chip
        size="small"
        variant="outlined"
        color={enabled ? 'success' : 'default'}
        label={enabled ? 'Active' : 'Inactive'}
        sx={{ ...chipSx, '& .MuiChip-label': { fontSize: '0.7rem', fontWeight: 700, px: 0.75 } }}
      />
      <Switch
        size="small"
        checked={enabled}
        onChange={onToggle}
        color="success"
        inputProps={{ 'aria-labelledby': 'rag-integration-title' }}
      />
    </Box>
    <Typography sx={meta}>
      {enabled
        ? 'Knowledge base documents are being used to enrich Cracky AI responses.'
        : 'Enable to let Cracky AI use knowledge base documents for contextual answers.'}
    </Typography>
  </Box>
);

IntegrationPanel.propTypes = {
  enabled: PropTypes.bool.isRequired,
  onToggle: PropTypes.func.isRequired,
};

const IndexNote = ({ stats }) => {
  if (stats.in_sync !== false) return null;
  const indexed = stats.indexed_chunks ?? 0;
  const collectionCount = stats.collection_count ?? 0;
  const neverSyncedEmpty = indexed === 0 && collectionCount === 0 && !stats.last_sync_at;
  const stale = indexed > 0 || !!stats.last_sync_at;
  if (stale && !neverSyncedEmpty) {
    return <Alert severity="warning" sx={{ mt: 1 }}>Index is stale. Sync to Vector DB</Alert>;
  }
  return (
    <Alert severity="info" sx={{ mt: 1 }}>
      The vector index starts empty. Click Sync to Vector DB, then poison a document.
    </Alert>
  );
};

IndexNote.propTypes = { stats: PropTypes.object.isRequired }; // eslint-disable-line react/forbid-prop-types

const Stat = ({ label, value }) => (
  <Box sx={{ flex: '1 1 0', minWidth: 0, textAlign: 'center' }}>
    <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', lineHeight: 1.2 }}>{value}</Typography>
    <Typography sx={{ ...meta, fontSize: '0.7rem' }}>{label}</Typography>
  </Box>
);

Stat.propTypes = { label: PropTypes.string.isRequired, value: PropTypes.oneOfType([PropTypes.number, PropTypes.string]).isRequired };

const Arrow = () => (
  <Typography aria-hidden="true" sx={{ color: 'text.disabled', alignSelf: 'center', fontSize: '0.8rem' }}>→</Typography>
);

const IndexPanel = ({ stats, onSync, busy }) => (
  <Box sx={panel}>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
      <Typography sx={sectionTitle} component="h2">Index pipeline</Typography>
      <Box sx={{ flex: 1 }} />
      {stats && (
        <Chip
          size="small"
          variant="outlined"
          color={stats.in_sync ? 'success' : 'warning'}
          label={stats.in_sync ? 'In sync' : 'Out of sync'}
          sx={{ ...chipSx, '& .MuiChip-label': { fontSize: '0.7rem', fontWeight: 700, px: 0.75 } }}
        />
      )}
    </Box>
    {stats ? (
      <>
        <Box
          role="group"
          aria-label={`Documents ${stats.db_documents ?? 0}, chunks ${stats.indexed_chunks ?? 0}, index ${stats.collection_count ?? 0}`}
          sx={{ display: 'flex', alignItems: 'stretch', gap: 0.5, p: 1, borderRadius: '8px', border: (t) => `1px solid ${t.palette.divider}`, bgcolor: (t) => alpha(t.palette.common.black, t.palette.mode === 'dark' ? 0.18 : 0.02) }}
        >
          <Stat label="Documents" value={stats.db_documents ?? 0} />
          <Arrow />
          <Stat label="Chunks" value={stats.indexed_chunks ?? 0} />
          <Arrow />
          <Stat label="Index" value={stats.collection_count ?? 0} />
        </Box>
        <IndexNote stats={stats} />
        <Typography sx={{ ...meta, mt: 0.75 }}>
          {stats.in_sync ? 'Index matches the database' : 'Documents exist that are not in the vector store'}
          {stats.last_sync_at ? ` · last sync ${stats.last_sync_at}` : ''}
        </Typography>
      </>
    ) : (
      <Typography sx={meta}>Index status is not available yet.</Typography>
    )}
    <Box sx={{ mt: 1.25 }}>
      <Button size="small" variant="outlined" color="inherit" onClick={onSync} disabled={busy} sx={quietButton}>
        Sync to Vector DB
      </Button>
    </Box>
  </Box>
);

IndexPanel.propTypes = {
  stats: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  onSync: PropTypes.func.isRequired,
  busy: PropTypes.bool.isRequired,
};

const bodyText = { fontSize: '0.82rem', lineHeight: 1.55, color: 'text.secondary', mt: 0.25 };

const RagRail = ({
  kbIntegration, onToggleIntegration, ragStats = null, onSync, busy = false,
}) => (
  <Box
    component="aside"
    aria-label="RAG status, defenses, and background"
    sx={{
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 1.5,
      position: { md: 'sticky' },
      top: { md: 72 },
    }}
  >
    <IntegrationPanel enabled={kbIntegration} onToggle={onToggleIntegration} />
    <IndexPanel stats={ragStats} onSync={onSync} busy={busy} />
    <Box sx={panel}>
      <Typography sx={sectionTitle} component="h2">Defense levels</Typography>
      <Typography sx={{ ...meta, mt: 0.25 }}>
        Switch the level in the header, then repeat the same retrieval.
      </Typography>
      <McpDefenseBehaviour surface="rag.kb" />
    </Box>
    <Box sx={{ ...panel, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
      <Typography sx={sectionTitle} component="h2">Background</Typography>
      <Disclosure title="What RAG is">
        <Typography sx={bodyText}>
          RAG is a technique where an LLM retrieves external documents to ground its responses in real data rather than
          relying solely on its training. In a real application this might pull from product databases, support
          documentation, internal wikis, or customer-generated content.
        </Typography>
      </Disclosure>
      <Disclosure title="How it works here">
        <Typography sx={bodyText}>
          Documents are converted into vector embeddings and stored in a ChromaDB vector database. When a user asks
          Cracky AI a question with KB integration enabled, the system finds the most semantically similar documents
          and injects them into the model&apos;s context window as trusted reference material.
        </Typography>
      </Disclosure>
      <Disclosure title="Why it matters">
        <Typography sx={bodyText}>
          Because the chatbot treats retrieved content as authoritative, anyone who can write to the knowledge base can
          influence what the chatbot tells users. This is the core attack surface for{' '}
          <Box component="span" sx={{ fontWeight: 700, color: 'text.primary' }}>OWASP LLM09 (Vector and Embedding Weaknesses)</Box>
          , and it is where <Box component="span" sx={mono}>retrieval.acl</Box> and{' '}
          <Box component="span" sx={mono}>retrieval.injection_scan</Box> apply at Level 2.
        </Typography>
      </Disclosure>
    </Box>
  </Box>
);

RagRail.propTypes = {
  kbIntegration: PropTypes.bool.isRequired,
  onToggleIntegration: PropTypes.func.isRequired,
  ragStats: PropTypes.object, // eslint-disable-line react/forbid-prop-types
  onSync: PropTypes.func.isRequired,
  busy: PropTypes.bool,
};

export default RagRail;
