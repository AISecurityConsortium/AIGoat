import React, { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { panel, sectionTitle } from '../common/panelStyles';
import ReviewSource from './ReviewSource';
import TicketSource from './TicketSource';

/** Region B: two scenarios, each runnable on its own. */
const AttackSources = ({
  state, examples, product, onProduct, busy, actions, onNotice,
}) => {
  const [tab, setTab] = useState('review');
  return (
    <Box component="section" aria-label="Attack sources" sx={panel}>
      <Typography component="h2" sx={{ ...sectionTitle, mb: 0.5 }}>Attack sources</Typography>
      <Tabs
        value={tab}
        onChange={(_, next) => setTab(next)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="Attack scenarios"
        sx={{ minHeight: 36, mb: 1.5, borderBottom: (t) => `1px solid ${t.palette.divider}`, '& .MuiTab-root': { minHeight: 36, textTransform: 'none', fontWeight: 600 } }}
      >
        <Tab value="review" label="1. Review poisoning" id="kc-tab-review" aria-controls="kc-panel-review" />
        <Tab value="ticket" label="2. Ticket attachment" id="kc-tab-ticket" aria-controls="kc-panel-ticket" />
      </Tabs>
      <Box role="tabpanel" id={`kc-panel-${tab}`} aria-labelledby={`kc-tab-${tab}`}>
        {tab === 'review' ? (
          <ReviewSource
            state={state}
            examples={examples}
            product={product}
            onProduct={onProduct}
            busy={busy}
            onSubmit={actions.submitReview}
          />
        ) : (
          <TicketSource
            state={state}
            busy={busy}
            onCreate={actions.createTicket}
            onAttach={actions.attach}
            onNotice={onNotice}
          />
        )}
      </Box>
    </Box>
  );
};

export default AttackSources;
