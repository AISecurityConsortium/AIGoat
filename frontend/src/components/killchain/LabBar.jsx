import React from 'react';
import {
  Box, Button, Chip, ToggleButton, ToggleButtonGroup, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { chipSx, meta, panel } from '../common/panelStyles';
import { OVERALL } from './styles';

export const LAB_TITLE = 'Agentic Kill Chain: The Compromised eCommerce Agent';
const DESCRIPTION = 'Untrusted content hides an instruction. Ingestion stores it in the connector\'s memory, the agent copies it into its own, '
  + 'and a routine request later makes the agent act on it. Poison the agent, watch the chain, then switch on human approval.';

const MODE_TEXT = {
  vulnerable: 'Vulnerable: the poison persists and sensitive tools run with no approval.',
  defended: 'Defended: the poison persists and is retrieved, but the backend holds each sensitive operation for an administrator.',
};

const Indicator = ({ label, value, tone = 'text.primary' }) => (
  <Box sx={{ minWidth: 0 }}>
    <Typography sx={{ ...meta, textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '0.68rem' }}>{label}</Typography>
    <Typography sx={{ fontWeight: 700, fontSize: '1.1rem', lineHeight: 1.2, color: tone }}>{value}</Typography>
  </Box>
);

const LabBar = ({
  state, busy, onMode, onHardReset,
}) => {
  const { mode, overall, status } = state;
  const overallMeta = OVERALL[overall] || OVERALL.baseline;
  const defended = mode === 'defended';
  const disabled = Boolean(busy);
  return (
    <Box
      component="section"
      aria-label="Lab header"
      sx={{
        ...panel,
        p: 2,
        borderLeft: (t) => `4px solid ${defended ? t.palette.success.main : t.palette.error.main}`,
      }}
    >
      <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <Box sx={{ flex: '1 1 340px', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
            <Typography component="h1" sx={{ fontSize: '1.3rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.3 }}>
              {LAB_TITLE}
            </Typography>
            <Chip
              label={overallMeta.label}
              color={overallMeta.color}
              size="small"
              variant={overall === 'baseline' ? 'outlined' : 'filled'}
              sx={chipSx}
              aria-label={`Lab state: ${overallMeta.label}`}
            />
          </Box>
          <Typography sx={{ ...meta, mt: 0.5, maxWidth: 760 }}>{DESCRIPTION}</Typography>
        </Box>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75, alignItems: { xs: 'stretch', sm: 'flex-end' } }}>
          <ToggleButtonGroup
            exclusive
            size="small"
            value={mode}
            disabled={disabled}
            aria-label="Defense mode"
            onChange={(_, next) => { if (next && next !== mode) onMode(next); }}
          >
            <ToggleButton
              value="vulnerable"
              sx={{
                textTransform: 'none', fontWeight: 700, px: 2,
                '&.Mui-selected': { bgcolor: (t) => alpha(t.palette.error.main, 0.2), color: 'error.light' },
              }}
            >
              Vulnerable
            </ToggleButton>
            <ToggleButton
              value="defended"
              sx={{
                textTransform: 'none', fontWeight: 700, px: 2,
                '&.Mui-selected': { bgcolor: (t) => alpha(t.palette.success.main, 0.2), color: 'success.light' },
              }}
            >
              Defended
            </ToggleButton>
          </ToggleButtonGroup>
          <Button
            size="small"
            variant="outlined"
            color="inherit"
            startIcon={<RestartAltIcon />}
            onClick={onHardReset}
            disabled={disabled}
            sx={{ textTransform: 'none', fontWeight: 600 }}
          >
            Hard reset
          </Button>
        </Box>
      </Box>
      <Typography sx={{ ...meta, mt: 1, fontWeight: 600, color: defended ? 'success.light' : 'error.light' }} role="status">
        {MODE_TEXT[mode]}
      </Typography>
      <Box
        sx={{
          mt: 1.5, pt: 1.5, display: 'grid', gap: 2,
          gridTemplateColumns: { xs: 'repeat(2, 1fr)', sm: 'repeat(4, 1fr)' },
          borderTop: (t) => `1px solid ${t.palette.divider}`,
        }}
      >
        <Indicator
          label="Poisoned memory"
          value={status.poisoned_memory}
          tone={status.poisoned_memory ? 'warning.main' : 'text.primary'}
        />
        <Indicator
          label="Pending approvals"
          value={status.pending_approvals}
          tone={status.pending_approvals ? 'warning.main' : 'text.primary'}
        />
        <Indicator
          label="Simulated exfiltration"
          value={status.exfiltration}
          tone={status.exfiltration ? 'error.main' : 'text.primary'}
        />
        <Indicator
          label="Coupon abuse"
          value={status.coupon_abuse}
          tone={status.coupon_abuse ? 'error.main' : 'text.primary'}
        />
      </Box>
    </Box>
  );
};

export default LabBar;
