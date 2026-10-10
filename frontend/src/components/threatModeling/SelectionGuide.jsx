import React, { useState } from 'react';
import { Box, Chip, Typography } from '@mui/material';
import { SELECTION_GUIDE } from '../../data/threatModeling/selectionGuide';
import { FRAMEWORK_BY_ID, FRAMEWORK_CATEGORIES } from '../../data/threatModeling/frameworks';
import { Body, FlagChip, SubHeading } from './labels';

const SelectionGuide = () => {
  const [selectedId, setSelectedId] = useState(SELECTION_GUIDE[0].id);
  const entry = SELECTION_GUIDE.find((e) => e.id === selectedId) || SELECTION_GUIDE[0];
  const primary = FRAMEWORK_BY_ID[entry.primary];

  return (
    <Box>
      <Body sx={{ mb: 2 }}>
        Pick the situation that is closest to yours. These are starting recommendations, not rigid rules: most real analyses combine a method with one or two knowledge sources.
      </Body>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'minmax(0, 5fr) minmax(0, 7fr)' }, gap: 2 }}>
        <Box role="radiogroup" aria-label="Your situation" sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {SELECTION_GUIDE.map((item) => {
            const active = item.id === selectedId;
            return (
              <Box
                key={item.id}
                component="button"
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setSelectedId(item.id)}
                data-testid={`guide-option-${item.id}`}
                sx={{
                  textAlign: 'left',
                  p: 1.25,
                  borderRadius: '10px',
                  cursor: 'pointer',
                  font: 'inherit',
                  fontSize: '0.9375rem',
                  lineHeight: 1.45,
                  color: 'text.primary',
                  bgcolor: (t) => (active ? (t.palette.custom?.overlay?.active ?? 'action.selected') : (t.palette.custom?.surface?.elevated ?? 'background.paper')),
                  border: (t) => `${active ? 2 : 1}px solid ${active ? t.palette.primary.main : (t.palette.custom?.border?.medium ?? t.palette.divider)}`,
                  '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main', outlineOffset: 2 },
                }}
              >
                {item.situation}
              </Box>
            );
          })}
        </Box>

        <Box
          data-testid="guide-result"
          aria-live="polite"
          sx={{
            p: { xs: 2, md: 2.5 },
            borderRadius: '12px',
            border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
            bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
            alignSelf: 'start',
          }}
        >
          <SubHeading>Primary recommendation</SubHeading>
          <Typography component="h3" data-testid="guide-primary" sx={{ fontWeight: 700, fontSize: '1.125rem' }}>{primary.name}</Typography>
          <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', my: 1 }}>
            <Chip size="small" color="primary" variant="outlined" label={FRAMEWORK_CATEGORIES[primary.category].label} />
            <FlagChip flag="analytical" />
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <SubHeading>Why it fits</SubHeading>
            <Body>{entry.why}</Body>
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <SubHeading>What it uncovers</SubHeading>
            <Body>{entry.uncovers}</Body>
          </Box>
          <Box sx={{ mt: 1.5 }}>
            <SubHeading>Add this perspective</SubHeading>
            <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mb: 0.75 }} data-testid="guide-complementary">
              {entry.complementary.map((id) => <Chip key={id} size="small" variant="outlined" label={FRAMEWORK_BY_ID[id].name} />)}
            </Box>
            <Body>{entry.complementaryNote}</Body>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default SelectionGuide;
