import React from 'react';
import { Box, Typography } from '@mui/material';
import { INTRO } from '../../data/threatModeling/content';
import { EVIDENCE_CLASSES, EVIDENCE_META, FLAG_META } from '../../data/threatModeling/evidence';
import { EvidenceChip, FlagChip, SubHeading } from './labels';

const IntroSection = () => (
  <Box>
    <Typography sx={{ fontSize: '1rem', lineHeight: 1.6, mb: 2, maxWidth: 820 }}>{INTRO.lead}</Typography>
    <Box component="ol" sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25, m: 0, p: 0, listStyle: 'none', mb: 2.5 }}>
      {INTRO.steps.map((s, i) => (
        <Box
          component="li"
          key={s.title}
          sx={{
            p: 1.5,
            borderRadius: '10px',
            border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
            bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
          }}
        >
          <Typography sx={{ fontWeight: 700, fontSize: '0.9375rem' }}>{`${i + 1}. ${s.title}`}</Typography>
          <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', lineHeight: 1.5 }}>{s.body}</Typography>
        </Box>
      ))}
    </Box>

    <Box
      data-testid="evidence-legend"
      sx={{
        p: 2,
        borderRadius: '10px',
        border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
      }}
    >
      <SubHeading component="h3">How to read the labels</SubHeading>
      <Typography sx={{ fontSize: '0.875rem', color: 'text.secondary', mb: 1.5 }}>{INTRO.legendIntro}</Typography>
      <Box component="dl" sx={{ m: 0, display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', sm: 'auto 1fr' }, columnGap: 2, rowGap: 1, alignItems: 'center' }}>
        {EVIDENCE_CLASSES.map((c) => (
          <React.Fragment key={c}>
            <Box component="dt"><EvidenceChip evidence={c} short={false} /></Box>
            <Typography component="dd" sx={{ m: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{EVIDENCE_META[c].description}</Typography>
          </React.Fragment>
        ))}
        {Object.keys(FLAG_META).map((f) => (
          <React.Fragment key={f}>
            <Box component="dt"><FlagChip flag={f} /></Box>
            <Typography component="dd" sx={{ m: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{FLAG_META[f].description}</Typography>
          </React.Fragment>
        ))}
      </Box>
    </Box>
  </Box>
);

export default IntroSection;
