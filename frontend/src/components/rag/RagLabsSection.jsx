import React from 'react';
import { Alert, Box, Button, Skeleton, Typography } from '@mui/material';
import { useLabs } from '../../hooks/useLabs';
import { EmptyState } from '../common';
import HubLabGroups from '../common/HubLabGroups';
import { RAG_NAV_GROUPS, RAG_ORDER, sortLabs } from '../../utils/labTeaching';

/** The RAG labs, grouped by decision, using the same cards as the MCP and Agentic hubs. */
const RagLabsSection = () => {
  const { labs: raw, loading, error, refetch } = useLabs({ surface: 'rag.kb' });
  const labs = sortLabs(raw, RAG_ORDER);

  return (
    <Box id="rag-labs" component="section" aria-label="RAG labs" sx={{ mt: 3, mb: 2 }}>
      <Box sx={{ mb: 1.5 }}>
        <Typography component="h2" sx={{ fontWeight: 700 }}>RAG labs</Typography>
        <Typography sx={{ color: 'text.secondary', fontSize: '0.9375rem' }}>
          Each lab opens this page with its objective, starting points, and defense behaviour.
        </Typography>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={<Button color="inherit" size="small" onClick={refetch}>Retry</Button>}
        >
          Could not load RAG labs. Confirm you are signed in and the API is running.
        </Alert>
      )}

      {loading && !labs.length && (
        <Box sx={{ display: 'grid', gap: 1.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, minmax(0, 1fr))' } }}>
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} variant="rounded" height={140} />)}
        </Box>
      )}

      {!loading && !labs.length && !error && (
        <EmptyState title="No RAG labs" description="The rag.kb surface has no labs yet." />
      )}

      <HubLabGroups groups={RAG_NAV_GROUPS} labs={labs} />
    </Box>
  );
};

export default RagLabsSection;
