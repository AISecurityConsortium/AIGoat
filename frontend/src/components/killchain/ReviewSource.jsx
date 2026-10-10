import React, { useState } from 'react';
import {
  Box, Button, Chip, MenuItem, Rating, TextField, Typography,
} from '@mui/material';
import Disclosure from '../common/Disclosure';
import { chipSx, inset, meta, mono } from '../common/panelStyles';

const DEFAULT_PLACEHOLDER = '<COUPON_CODE>';
const SHOWN_REVIEWS = 6;

/** The internal coupon, once a coupon export has reached the attacker inbox. Never read from anywhere else. */
export const learnedCoupon = (inbox) => {
  for (const mail of inbox || []) {
    if (mail.dataset === 'coupons') {
      const hit = (mail.payload?.records || []).find((record) => record.internal);
      if (hit) return hit.code;
    }
  }
  return '';
};

/**
 * Scenario 1. The learner writes an ordinary review and, optionally, a hidden note. The note is
 * stored inside the review as an HTML comment, so the real record carries it.
 */
const ReviewSource = ({
  state, examples, product, onProduct, busy, onSubmit,
}) => {
  const [rating, setRating] = useState(5);
  const [text, setText] = useState('');
  const [hidden, setHidden] = useState('');
  const disabled = Boolean(busy);
  const chosen = state.products.find((p) => p.sku === product);
  const productReviews = state.reviews.filter((r) => r.sku === product);
  const shown = productReviews.slice(0, SHOWN_REVIEWS);
  const placeholder = examples?.coupon_placeholder || DEFAULT_PLACEHOLDER;
  const learned = learnedCoupon(state.inbox);
  const loadExample = (item) => setHidden(item.text.split(placeholder).join(learned || placeholder));

  const submit = async (event) => {
    event.preventDefault();
    const result = await onSubmit({
      product, rating, text: text.trim(), hidden: hidden.trim(),
    });
    if (result) {
      setText('');
      setHidden('');
    }
  };

  return (
    <Box component="form" onSubmit={submit} aria-label="Submit a product review" sx={{ display: 'grid', gap: 1.25 }}>
      <Typography sx={meta}>
        Write a normal-looking review and hide an instruction in it. Shoppers see only the review text. The ingestion pipeline reads the whole stored record.
      </Typography>
      <Box sx={{ display: 'flex', gap: 1.25, flexWrap: 'wrap', alignItems: 'center' }}>
        <TextField
          select
          size="small"
          label="Product"
          value={product}
          onChange={(e) => onProduct(e.target.value)}
          sx={{ flex: '1 1 220px' }}
        >
          {state.products.map((p) => (
            <MenuItem key={p.sku} value={p.sku}>{`${p.name} ($${p.price})`}</MenuItem>
          ))}
        </TextField>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
          <Typography id="kc-rating-label" sx={meta}>Rating</Typography>
          <Rating
            name="kc-rating"
            size="small"
            value={rating}
            onChange={(_, next) => setRating(next || 1)}
            aria-labelledby="kc-rating-label"
          />
        </Box>
      </Box>
      <TextField
        size="small"
        label="Review text (visible to shoppers)"
        value={text}
        onChange={(e) => setText(e.target.value)}
        multiline
        minRows={2}
        inputProps={{ maxLength: 1500 }}
        required
      />
      <TextField
        size="small"
        label="Hidden instruction (stored as an HTML comment)"
        value={hidden}
        onChange={(e) => setHidden(e.target.value)}
        multiline
        minRows={3}
        inputProps={{ maxLength: 1500, style: { fontFamily: mono.fontFamily, fontSize: '0.8rem' } }}
        helperText="Leave empty for an ordinary review."
      />
      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography sx={meta}>Load an example:</Typography>
        {(examples?.procedures || []).map((item) => (
          <Chip
            key={item.id}
            label={item.label}
            size="small"
            variant="outlined"
            clickable
            onClick={() => loadExample(item)}
            sx={chipSx}
          />
        ))}
      </Box>
      <Typography sx={meta} role="note">
        {learned
          ? `Coupon code learned from the attacker inbox: ${learned}. The abuse example now uses it.`
          : `The attacker does not know the internal coupon yet. The abuse example keeps ${placeholder} until a coupon export reaches the attacker inbox.`}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button type="submit" variant="contained" size="small" disabled={disabled || !text.trim()} sx={{ textTransform: 'none', fontWeight: 700 }}>
          Submit review
        </Button>
        {chosen && (
          <Typography sx={meta}>
            {chosen.review_count} reviews, average {chosen.average_rating ?? 'n/a'}
          </Typography>
        )}
      </Box>

      <Box sx={{ ...inset, p: 1.25 }}>
        <Typography sx={{ fontWeight: 700, fontSize: '0.82rem', mb: 0.5 }}>
          {chosen ? `Reviews for ${chosen.name}` : 'Reviews'}
        </Typography>
        {shown.length === 0 && (
          <Typography sx={meta}>No reviews on this product yet. Yours will appear here as shoppers see it.</Typography>
        )}
        {shown.map((review) => (
          <Box key={review.id} sx={{ py: 0.75, borderTop: (t) => `1px solid ${t.palette.divider}`, '&:first-of-type': { borderTop: 0 } }}>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Typography sx={{ fontWeight: 600, fontSize: '0.82rem' }}>{review.author}</Typography>
              <Rating value={review.rating} size="small" readOnly aria-label={`${review.rating} of 5`} />
              {!review.seeded && <Chip label="Yours" size="small" color="primary" variant="outlined" sx={chipSx} />}
              {review.has_hidden_markup && <Chip label="Contains hidden markup" size="small" color="warning" variant="outlined" sx={chipSx} />}
            </Box>
            <Typography sx={{ fontSize: '0.85rem', mt: 0.25 }}>{review.text}</Typography>
            {(!review.seeded || review.has_hidden_markup) && (
              <Disclosure title="Raw stored record" meta="what ingestion reads" sx={{ mt: 0.75 }}>
                <Box component="pre" sx={{ ...mono, fontSize: '0.75rem', m: 0, p: 1, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {review.raw}
                </Box>
              </Disclosure>
            )}
          </Box>
        ))}
        {productReviews.length > shown.length && (
          <Typography sx={{ ...meta, mt: 0.5 }}>{`Showing the newest ${shown.length} of ${productReviews.length}.`}</Typography>
        )}
      </Box>
    </Box>
  );
};

export default ReviewSource;
