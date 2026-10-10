import React, { useState } from 'react';
import {
  Alert, Box, Button, Chip, TextField, Typography,
} from '@mui/material';
import { chipSx, inset, meta, mono, panel, sectionTitle } from '../common/panelStyles';
import { fmtTime } from './styles';

/**
 * Pricing evidence. The storefront check shows what a shopper gets for a coupon. The list below shows
 * what the agent's pricing tool charged, which is where the poisoned agent differs.
 */
const ImpactPanel = ({
  checkouts, coupons, universal, product, products, busy, onStorefront,
}) => {
  const [code, setCode] = useState('');
  const [result, setResult] = useState(null);
  const abused = checkouts.filter((c) => c.coupon_code === universal);
  const chosen = products.find((p) => p.sku === product);

  const tryCode = async (event) => {
    event.preventDefault();
    const outcome = await onStorefront(code.trim(), product);
    if (outcome) setResult(outcome);
  };

  return (
    <Box component="section" aria-label="Checkout and coupon impact" sx={panel}>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap', mb: 0.5 }}>
        <Typography component="h2" sx={sectionTitle}>Checkout impact</Typography>
        <Chip
          label={abused.length ? `${abused.length} priced at the universal price` : 'No abuse yet'}
          size="small"
          color={abused.length ? 'error' : 'default'}
          variant="outlined"
          sx={chipSx}
        />
      </Box>
      <Typography sx={{ ...meta, mb: 1 }}>
        {`${universal} is a staff coupon. A shopper cannot use it, but the agent's pricing tool runs with staff authority and does not check who is asking. No real order is placed in this lab, the tool returns the price the shop would charge.`}
      </Typography>

      <Box component="form" onSubmit={tryCode} aria-label="Try a coupon as a shopper" sx={{ ...inset, p: 1.25, display: 'grid', gap: 1, mb: 1 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Try a code as a shopper</Typography>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <TextField
            size="small"
            label="Coupon code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            inputProps={{ maxLength: 40 }}
            sx={{ flex: '1 1 160px' }}
          />
          <Button
            type="submit"
            variant="outlined"
            size="small"
            disabled={Boolean(busy) || !code.trim() || !chosen}
            sx={{ textTransform: 'none', fontWeight: 600, mt: 0.25 }}
          >
            Apply at the storefront
          </Button>
        </Box>
        <Typography sx={meta}>
          {chosen ? `Applies to ${chosen.name}, the product selected in the review form.` : 'Select a product in the review form first.'}
        </Typography>
        {result && (
          <Alert severity={result.accepted ? 'success' : 'error'} sx={{ fontSize: '0.82rem' }} role="status">
            {result.accepted
              ? `${result.message}: ${result.product} goes from $${result.list_price} to $${result.final_price}.`
              : `${result.message}. ${result.reason}`}
          </Alert>
        )}
      </Box>

      <Box sx={{ ...inset, p: 1.25, display: 'grid', gap: 0.5 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem' }}>Prices set by the agent</Typography>
        {checkouts.length === 0 && <Typography sx={meta}>No priced checkouts yet.</Typography>}
        {checkouts.map((row) => (
          <Box key={row.id} sx={{ display: 'flex', gap: 1, alignItems: 'baseline', flexWrap: 'wrap' }}>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 600 }}>{row.product}</Typography>
            <Typography sx={meta}>{`list $${row.list_price}`}</Typography>
            <Typography sx={{ fontSize: '0.82rem', fontWeight: 700, color: row.coupon_code === universal ? 'error.main' : 'text.primary' }}>
              {`priced at $${row.final_price}`}
            </Typography>
            {row.coupon_code && <Chip label={row.coupon_code} size="small" variant="outlined" color={row.coupon_code === universal ? 'error' : 'default'} sx={chipSx} />}
            <Typography sx={{ ...meta, ml: 'auto' }}>{fmtTime(row.created_at)}</Typography>
          </Box>
        ))}
      </Box>
      <Typography sx={{ ...meta, ...mono, mt: 1 }}>
        {`Coupons on file: ${coupons.map((c) => c.code).join(', ') || 'none'}`}
      </Typography>
    </Box>
  );
};

export default ImpactPanel;
