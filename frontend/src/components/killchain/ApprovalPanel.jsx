import React from 'react';
import {
  Box, Button, Chip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import GavelIcon from '@mui/icons-material/Gavel';
import { chipSx, inset, meta, mono } from '../common/panelStyles';
import { ACTION_LABELS, APPROVAL_STATUS, fmtTime } from './styles';

export const StatusChip = ({ status }) => {
  const info = APPROVAL_STATUS[status] || { label: status, color: 'default' };
  return <Chip label={info.label} color={info.color} size="small" variant={status === 'pending' ? 'filled' : 'outlined'} sx={chipSx} />;
};

/** Administrator approval panel. The backend holds the operation until one of these buttons is pressed. */
const ApprovalPanel = ({ approvals, busy, onDecide }) => {
  const pending = approvals.filter((a) => a.status === 'pending');
  const history = approvals.filter((a) => a.status !== 'pending').slice(0, 4);
  if (pending.length === 0 && history.length === 0) return null;
  return (
    <Box component="section" aria-label="Administrator approval" sx={{ display: 'grid', gap: 1 }}>
      {pending.map((item) => (
        <Box
          key={item.id}
          role="alert"
          sx={{
            ...inset,
            p: 1.5,
            borderColor: 'warning.main',
            borderWidth: 2,
            bgcolor: (t) => alpha(t.palette.warning.main, 0.1),
          }}
        >
          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.75 }}>
            <GavelIcon fontSize="small" color="warning" />
            <Typography sx={{ fontWeight: 700 }}>{`Approval ${item.id} needed: ${ACTION_LABELS[item.action_type] || item.action_type}`}</Typography>
            <StatusChip status={item.status} />
          </Box>
          <Typography sx={{ fontSize: '0.95rem', mb: 0.75, lineHeight: 1.55 }}>{item.reason}</Typography>
          <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: 'max-content 1fr', columnGap: 1.5, rowGap: 0.5, fontSize: '0.9rem' }}>
            <Typography component="dt" sx={meta}>Operation</Typography>
            <Typography component="dd" sx={{ m: 0, ...mono, fontSize: '0.78rem' }}>
              {`${item.tool}(${Object.entries(item.arguments).filter(([, v]) => v !== '').map(([k, v]) => `${k}=${v}`).join(', ')})`}
            </Typography>
            <Typography component="dt" sx={meta}>Target</Typography>
            <Typography component="dd" sx={{ m: 0 }}>{item.target}</Typography>
            <Typography component="dt" sx={meta}>Data involved</Typography>
            <Box component="dd" sx={{ m: 0, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
              {item.categories.map((c) => <Chip key={c} label={c.replace(/_/g, ' ')} size="small" variant="outlined" sx={chipSx} />)}
            </Box>
            <Typography component="dt" sx={meta}>If approved</Typography>
            <Box component="dd" sx={{ m: 0 }}>
              {item.effects.map((effect) => <Typography key={effect} sx={{ fontSize: '0.9rem', lineHeight: 1.5 }}>{effect}</Typography>)}
            </Box>
          </Box>
          <Box sx={{ display: 'flex', gap: 1, mt: 1.25 }}>
            <Button variant="contained" color="warning" size="small" disabled={Boolean(busy)} onClick={() => onDecide(item.id, 'approve')} sx={{ textTransform: 'none', fontWeight: 700 }}>
              Approve
            </Button>
            <Button variant="outlined" color="inherit" size="small" disabled={Boolean(busy)} onClick={() => onDecide(item.id, 'reject')} sx={{ textTransform: 'none', fontWeight: 600 }}>
              Reject
            </Button>
          </Box>
        </Box>
      ))}
      {history.length > 0 && (
        <Box sx={{ ...inset, p: 1 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '0.8rem', mb: 0.5 }}>Recent decisions</Typography>
          {history.map((item) => (
            <Box key={item.id} sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', py: 0.25 }}>
              <StatusChip status={item.status} />
              <Typography sx={{ fontSize: '0.8rem' }}>{`#${item.id} ${ACTION_LABELS[item.action_type] || item.action_type}`}</Typography>
              <Typography sx={meta}>{`${item.target}, ${fmtTime(item.decided_at || item.created_at)}`}</Typography>
            </Box>
          ))}
        </Box>
      )}
    </Box>
  );
};

export default ApprovalPanel;
