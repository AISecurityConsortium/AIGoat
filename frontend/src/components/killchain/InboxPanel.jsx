import React, { useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { alpha } from '@mui/material/styles';
import { chipSx, inset, meta, mono, panel, sectionTitle } from '../common/panelStyles';
import { fmtDateTime } from './styles';

const Row = ({ label, children }) => (
  <>
    <Typography component="dt" sx={meta}>{label}</Typography>
    <Typography component="dd" sx={{ m: 0, fontSize: '0.8rem', minWidth: 0, wordBreak: 'break-word' }}>{children}</Typography>
  </>
);

/** What the attacker received. Mail here is a database row. Nothing leaves the application. */
const InboxPanel = ({ inbox, attacker }) => {
  const [open, setOpen] = useState(0);
  return (
    <Box component="section" aria-label="Attacker inbox" sx={panel}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
        <Typography component="h2" sx={sectionTitle}>Attacker inbox</Typography>
        <Chip label={`${inbox.length} received`} size="small" color={inbox.length ? 'error' : 'default'} variant="outlined" sx={chipSx} />
      </Box>
      <Typography sx={{ ...meta, mb: 1 }}>
        {`Simulated mailbox for ${attacker}. No email is sent. Synthetic customer and coupon data only.`}
      </Typography>
      {inbox.length === 0 && (
        <Box sx={{ ...inset, p: 1.5 }}>
          <Typography sx={meta}>Empty. If the poisoned agent sends data to this address, the message lands here.</Typography>
        </Box>
      )}
      <Box role="list" aria-label="Received messages" sx={{ display: 'grid', gap: 1 }}>
        {inbox.map((mail) => {
          const expanded = open === mail.id;
          return (
            <Box key={mail.id} role="listitem" sx={{ ...inset, borderColor: (t) => alpha(t.palette.error.main, 0.5) }}>
              <Box
                component="button"
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen(expanded ? 0 : mail.id)}
                sx={{ all: 'unset', boxSizing: 'border-box', width: '100%', cursor: 'pointer', p: 1.25, display: 'block', '&:focus-visible': { outline: (t) => `2px solid ${t.palette.primary.main}`, outlineOffset: -2 } }}
              >
                <Box sx={{ display: 'flex', gap: 0.75, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Typography sx={{ fontWeight: 700, fontSize: '0.85rem' }}>{mail.subject}</Typography>
                  <Chip label={mail.dataset} size="small" color="error" variant="outlined" sx={chipSx} />
                  <Typography sx={{ ...meta, ml: 'auto' }}>{fmtDateTime(mail.created_at)}</Typography>
                </Box>
                <Typography sx={meta}>
                  {`To ${mail.recipient}${mail.bcc ? `, BCC ${mail.bcc}` : ''}`}
                </Typography>
              </Box>
              {expanded && (
                <Box sx={{ px: 1.25, pb: 1.25 }}>
                  <Box component="dl" sx={{ m: 0, mb: 0.75, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 1.5, rowGap: 0.25 }}>
                    <Row label="From">{mail.sender}</Row>
                    <Row label="Recipient">{mail.recipient}</Row>
                    <Row label="BCC">{mail.bcc || 'none'}</Row>
                    <Row label="Data">{mail.categories.map((c) => c.replace(/_/g, ' ')).join(', ')}</Row>
                    <Row label="Linked run">{mail.execution_id}</Row>
                    {mail.approval_id ? <Row label="Approval">{`#${mail.approval_id}`}</Row> : null}
                  </Box>
                  <Box component="pre" sx={{ ...mono, fontSize: '0.74rem', m: 0, p: 1, borderRadius: '6px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: 240, overflow: 'auto', bgcolor: (t) => alpha(t.palette.text.primary, 0.05) }}>
                    {JSON.stringify(mail.payload, null, 2)}
                  </Box>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

export default InboxPanel;
