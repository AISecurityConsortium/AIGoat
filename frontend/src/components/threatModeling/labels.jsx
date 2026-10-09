import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import {
  CheckCircleOutline as VerifiedIcon,
  HelpOutline as HypothesisIcon,
  ReportProblemOutlined as ValidateIcon,
  SchoolOutlined as ByDesignIcon,
  BlockOutlined as AbsenceIcon,
  LightbulbOutlined as AnalyticalIcon,
} from '@mui/icons-material';
import { EVIDENCE_META, FLAG_META } from '../../data/threatModeling/evidence';

const EVIDENCE_STYLE = {
  verified: { Icon: VerifiedIcon, color: 'success', variant: 'filled' },
  hypothesis: { Icon: HypothesisIcon, color: 'info', variant: 'outlined' },
  'needs-validation': { Icon: ValidateIcon, color: 'warning', variant: 'outlined' },
};

const FLAG_STYLE = {
  byDesign: { Icon: ByDesignIcon, color: 'secondary' },
  absence: { Icon: AbsenceIcon, color: 'default' },
  analytical: { Icon: AnalyticalIcon, color: 'default' },
};

/**
 * The label always has text and an icon, so evidence class never depends on
 * colour alone.
 */
export const EvidenceChip = ({ evidence, short = true }) => {
  const meta = EVIDENCE_META[evidence];
  const style = EVIDENCE_STYLE[evidence];
  if (!meta || !style) return null;
  const { Icon } = style;
  return (
    <Tooltip title={meta.description} arrow>
      <Chip
        size="small"
        variant={style.variant}
        color={style.color}
        icon={<Icon sx={{ fontSize: '0.95rem !important' }} />}
        label={short ? meta.short : meta.label}
        data-testid={`evidence-${evidence}`}
        sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
      />
    </Tooltip>
  );
};

EvidenceChip.propTypes = {
  evidence: PropTypes.string.isRequired,
  short: PropTypes.bool,
};

export const FlagChip = ({ flag }) => {
  const meta = FLAG_META[flag];
  const style = FLAG_STYLE[flag];
  if (!meta || !style) return null;
  const { Icon } = style;
  return (
    <Tooltip title={meta.description} arrow>
      <Chip
        size="small"
        variant="outlined"
        color={style.color}
        icon={<Icon sx={{ fontSize: '0.95rem !important' }} />}
        label={meta.label}
        data-testid={`flag-${flag}`}
        sx={{ height: 22, fontSize: '0.75rem', fontWeight: 600 }}
      />
    </Tooltip>
  );
};

FlagChip.propTypes = { flag: PropTypes.string.isRequired };

/** Flags can be given as a list or as boolean shorthands on the claim. */
export const claimFlags = (claim) => {
  const flags = new Set(claim.flags || []);
  if (claim.byDesign) flags.add('byDesign');
  if (claim.absence) flags.add('absence');
  if (claim.analytical) flags.add('analytical');
  return Array.from(flags);
};

/** One claim: text plus its evidence class, flags and repo references. */
export const ClaimRow = ({ claim }) => (
  <Box
    component="li"
    sx={{ mb: 1.25, listStyle: 'none' }}
    data-testid="claim-row"
    data-evidence={claim.evidence}
  >
    <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center', mb: 0.5 }}>
      <EvidenceChip evidence={claim.evidence} />
      {claimFlags(claim).map((flag) => (
        <FlagChip key={flag} flag={flag} />
      ))}
    </Box>
    <Typography sx={{ fontSize: '0.9375rem', lineHeight: 1.55 }}>{claim.text}</Typography>
    {claim.refs && claim.refs.length > 0 && (
      <Typography
        sx={{
          fontSize: '0.8125rem',
          mt: 0.25,
          color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
          fontFamily: '"JetBrains Mono", monospace',
          wordBreak: 'break-word',
        }}
      >
        {claim.refs.join('  ')}
      </Typography>
    )}
  </Box>
);

ClaimRow.propTypes = {
  claim: PropTypes.shape({
    text: PropTypes.string.isRequired,
    evidence: PropTypes.string.isRequired,
    refs: PropTypes.arrayOf(PropTypes.string),
    flags: PropTypes.arrayOf(PropTypes.string),
    byDesign: PropTypes.bool,
    absence: PropTypes.bool,
    analytical: PropTypes.bool,
  }).isRequired,
};

export const ClaimList = ({ claims, empty }) => {
  if (!claims || claims.length === 0) {
    return empty ? (
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary' }}>{empty}</Typography>
    ) : null;
  }
  return (
    <Box component="ul" sx={{ m: 0, p: 0 }}>
      {claims.map((c) => <ClaimRow key={c.text} claim={c} />)}
    </Box>
  );
};

ClaimList.propTypes = {
  claims: PropTypes.arrayOf(PropTypes.object),
  empty: PropTypes.string,
};

export const SubHeading = ({ children, component = 'h4' }) => (
  <Typography
    component={component}
    sx={{
      fontSize: '0.8125rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
      mb: 0.75,
    }}
  >
    {children}
  </Typography>
);

SubHeading.propTypes = { children: PropTypes.node.isRequired, component: PropTypes.string };

export const Body = ({ children, sx }) => (
  <Typography
    sx={{
      fontSize: '0.9375rem',
      lineHeight: 1.65,
      color: (t) => t.palette.custom?.text?.body ?? 'text.primary',
      ...sx,
    }}
  >
    {children}
  </Typography>
);

Body.propTypes = { children: PropTypes.node.isRequired, sx: PropTypes.object };
