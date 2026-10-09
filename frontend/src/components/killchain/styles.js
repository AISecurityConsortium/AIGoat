import { alpha } from '@mui/material/styles';

/** Visual language of the trace. Colour always travels with a text label. */
export const eventTone = (event) => {
  const { kind, status } = event;
  if ((kind === 'exfiltration' || kind === 'coupon_abuse') && status === 'success') {
    return { label: kind === 'exfiltration' ? 'Exfiltration' : 'Coupon abuse', color: 'error', strong: true };
  }
  if (status === 'pending') return { label: 'Approval required', color: 'warning', strong: true };
  if (status === 'approved') return { label: 'Approved', color: 'info' };
  if (status === 'rejected') return { label: 'Rejected', color: 'success' };
  if (status === 'blocked') return { label: 'Blocked', color: 'success' };
  if (status === 'failed') return { label: 'Failed', color: 'error' };
  if (['review_submitted', 'ticket_created', 'attachment_uploaded', 'content_extracted', 'cache_hit', 'ingest_clean'].includes(kind)) {
    return { label: 'Ingestion', color: 'primary' };
  }
  if (kind === 'connector_memory_write' || kind === 'agent_memory_write') return { label: 'Memory write', color: 'secondary' };
  if (kind === 'memory_retrieval') return { label: 'Retrieval', color: 'secondary' };
  if (kind === 'tool_call' || kind === 'tool_result') return { label: 'Tool', color: 'info' };
  if (kind === 'policy_decision') return { label: 'Policy', color: 'warning' };
  if (kind === 'mail_delivered') return { label: 'Mock email', color: 'warning' };
  if (kind === 'storefront_coupon') return { label: 'Storefront', color: 'info' };
  if (kind === 'cleanup' || kind === 'hard_reset' || kind === 'mode_changed') return { label: 'Admin', color: 'default' };
  if (kind === 'attack_not_triggered') return { label: 'Not triggered', color: 'default' };
  return { label: 'Agent', color: 'default' };
};

export const toneBg = (theme, color) => (
  color === 'default' ? alpha(theme.palette.text.primary, 0.06) : alpha(theme.palette[color].main, 0.14)
);

export const APPROVAL_STATUS = {
  pending: { label: 'Pending', color: 'warning' },
  approved: { label: 'Approved', color: 'info' },
  rejected: { label: 'Rejected', color: 'success' },
  executed: { label: 'Executed', color: 'error' },
  failed: { label: 'Failed', color: 'default' },
};

export const OVERALL = {
  baseline: { label: 'Baseline', color: 'default' },
  poisoned: { label: 'Poisoned', color: 'warning' },
  compromised: { label: 'Compromised', color: 'error' },
  awaiting_approval: { label: 'Awaiting approval', color: 'warning' },
};

export const ACTION_LABELS = {
  customer_data_export: 'Customer data export',
  coupon_disclosure: 'Coupon inventory disclosure',
  universal_discount: 'Universal discount',
};

export const fmtTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
};

export const fmtDateTime = (iso) => {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
};

export const sourceLabel = (type, id) => (type === 'review' ? `review ${id}` : `ticket attachment ${id}`);
