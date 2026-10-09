import React, { useEffect, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, Typography,
} from '@mui/material';
import ConfirmDialog from '../common/ConfirmDialog';
import AgentPanel from './AgentPanel';
import AttackSources from './AttackSources';
import ImpactPanel from './ImpactPanel';
import InboxPanel from './InboxPanel';
import LabBar from './LabBar';
import MemoryInspector from './MemoryInspector';
import TracePanel from './TracePanel';
import useKillChain from './useKillChain';

const AREAS = {
  xs: '"sources" "agent" "trace" "memory" "inbox"',
  md: '"sources agent" "memory trace" "inbox trace"',
};

const CLEANUP_NOTICE = {
  agent_memory: 'Agent memory cleared. The connector memory is untouched, so the agent re-copies it at its next request.',
  connector_cache: 'Connector cache cleared. Agent memory is untouched and still poisoned.',
  soft_reset: 'Soft reset done. A persistent layer survived, check both memory tabs.',
  hard_reset: 'Hard reset done. Every record is back to the seeded baseline.',
};

/** The whole lab on one screen: sources, agent, memory, trace, inbox. */
const KillChainWorkbench = () => {
  const kc = useKillChain();
  const { state } = kc;
  const [product, setProduct] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);

  useEffect(() => {
    if (state && !product && state.products.length) setProduct(state.products[0].sku);
  }, [state, product]);

  if (!state) {
    return (
      <Box sx={{ p: 3, display: 'grid', gap: 1.5, justifyItems: 'start' }}>
        {kc.error ? (
          <>
            <Alert severity="error" sx={{ maxWidth: 560 }}>{kc.error}</Alert>
            <Button variant="outlined" onClick={kc.refresh} sx={{ textTransform: 'none' }}>Try again</Button>
          </>
        ) : (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }} role="status">
            <CircularProgress size={18} />
            <Typography>Loading the lab</Typography>
          </Box>
        )}
      </Box>
    );
  }

  const doReset = async () => {
    setConfirmReset(false);
    await kc.cleanup('hard_reset', CLEANUP_NOTICE.hard_reset);
  };

  const cleanup = (kind) => kc.cleanup(kind, CLEANUP_NOTICE[kind]);

  return (
    <Box sx={{ display: 'grid', gap: 1.5 }}>
      <LabBar state={state} busy={kc.busy} onMode={kc.changeMode} onHardReset={() => setConfirmReset(true)} />

      {kc.notice && (
        <Alert severity={kc.notice.severity} onClose={() => kc.setNotice(null)} role="status">
          {kc.notice.message}
        </Alert>
      )}
      {kc.error && <Alert severity="warning">{kc.error}</Alert>}

      <Box
        sx={{
          display: 'grid',
          gap: 1.5,
          alignItems: 'start',
          gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' },
          gridTemplateAreas: { xs: AREAS.xs, md: AREAS.md },
        }}
      >
        <Box sx={{ gridArea: 'sources', minWidth: 0 }}>
          <AttackSources
            state={state}
            examples={kc.examples}
            product={product}
            onProduct={setProduct}
            busy={kc.busy}
            onNotice={kc.setNotice}
            actions={{ submitReview: kc.submitReview, createTicket: kc.createTicket, attach: kc.attach }}
          />
        </Box>
        <Box sx={{ gridArea: 'agent', minWidth: 0 }}>
          <AgentPanel
            state={state}
            busy={kc.busy}
            lastRun={kc.lastRun}
            examples={kc.examples}
            models={kc.models}
            product={product}
            onSend={kc.runTurn}
            onDecide={kc.decide}
          />
        </Box>
        <Box sx={{ gridArea: 'memory', minWidth: 0 }}>
          <MemoryInspector state={state} busy={kc.busy} onCleanup={cleanup} />
        </Box>
        <Box sx={{ gridArea: 'trace', minWidth: 0 }}>
          <TracePanel events={state.events} busy={kc.busy} />
        </Box>
        <Box sx={{ gridArea: 'inbox', minWidth: 0, display: 'grid', gap: 1.5 }}>
          <InboxPanel inbox={state.inbox} attacker={state.attacker_address} />
          <ImpactPanel
            checkouts={state.checkouts}
            coupons={state.coupons}
            universal={state.universal_coupon}
            product={product}
            products={state.products}
            busy={kc.busy}
            onStorefront={kc.storefront}
          />
        </Box>
      </Box>

      <ConfirmDialog
        open={confirmReset}
        title="Hard reset the lab?"
        message="This deletes your reviews, tickets, uploads, both memories, the cache, approvals, mail and the trace, and restores the seeded baseline. The mode stays as it is."
        confirmLabel="Hard reset"
        destructive
        onConfirm={doReset}
        onCancel={() => setConfirmReset(false)}
      />
    </Box>
  );
};

export default KillChainWorkbench;
