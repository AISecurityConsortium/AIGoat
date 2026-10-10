import React from 'react';
import { Box, Typography, useMediaQuery } from '@mui/material';
import { LIFECYCLE, PRACTICES, PRACTICE_COMPLEMENT, WHY_IT_MATTERS } from '../../data/threatModeling/content';
import { Body, SubHeading } from './labels';

const cardSx = {
  p: 1.75,
  borderRadius: '10px',
  border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
  bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
};

const PracticeTable = () => {
  const stacked = useMediaQuery('(max-width:899px)');
  const cols = [
    { key: 'asks', label: 'Question it asks' },
    { key: 'when', label: 'When' },
    { key: 'output', label: 'Output' },
    { key: 'note', label: 'Note' },
  ];
  if (stacked) {
    return (
      <Box data-testid="practice-stacked" sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {PRACTICES.map((p) => (
          <Box key={p.id} sx={cardSx}>
            <Typography sx={{ fontWeight: 700, mb: 0.5 }}>{p.name}</Typography>
            {cols.map((c) => (
              <Typography key={c.key} sx={{ fontSize: '0.875rem', lineHeight: 1.5 }}>
                <strong>{c.label}:</strong> {p[c.key]}
              </Typography>
            ))}
          </Box>
        ))}
      </Box>
    );
  }
  return (
    <Box
      component="table"
      data-testid="practice-table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: '0.875rem',
        '& th, & td': { textAlign: 'left', verticalAlign: 'top', p: 1.25, borderBottom: (t) => `1px solid ${t.palette.divider}` },
        '& th': { fontWeight: 700 },
      }}
    >
      <thead>
        <tr>
          <th scope="col">Practice</th>
          {cols.map((c) => <th key={c.key} scope="col">{c.label}</th>)}
        </tr>
      </thead>
      <tbody>
        {PRACTICES.map((p) => (
          <tr key={p.id}>
            <th scope="row">{p.name}</th>
            {cols.map((c) => <td key={c.key}>{p[c.key]}</td>)}
          </tr>
        ))}
      </tbody>
    </Box>
  );
};

const WhyItMatters = () => (
  <Box>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 1.25, mb: 3 }}>
      {WHY_IT_MATTERS.map((r) => (
        <Box key={r.id} sx={cardSx} data-testid={`why-${r.id}`}>
          <Typography component="h3" sx={{ fontWeight: 700, fontSize: '0.9375rem', mb: 0.5 }}>{r.title}</Typography>
          <Body>{r.body}</Body>
          <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mt: 0.75 }}>
            <strong>In AIGoat:</strong> {r.aigoat}
          </Typography>
        </Box>
      ))}
    </Box>

    <SubHeading component="h3">How it differs from other practices</SubHeading>
    <PracticeTable />
    <Body sx={{ mt: 1.5, mb: 3 }}>{PRACTICE_COMPLEMENT}</Body>

    <SubHeading component="h3">A practical lifecycle</SubHeading>
    <Box component="ol" data-testid="lifecycle" sx={{ m: 0, pl: 2.5 }}>
      {LIFECYCLE.map((step) => (
        <Typography key={step.id} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.55, mb: 0.75 }}>
          <strong>{step.title}.</strong> {step.body}
        </Typography>
      ))}
    </Box>
  </Box>
);

export default WhyItMatters;
