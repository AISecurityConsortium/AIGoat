import React from 'react';
import { Box, Link, Typography } from '@mui/material';
import { LINKS_CHECKED_ON, REFERENCE_GROUPS } from '../../data/threatModeling/content';
import { SubHeading } from './labels';

const References = () => (
  <Box>
    <Typography sx={{ fontSize: '0.8125rem', color: 'text.secondary', mb: 2 }}>
      Links were checked for a successful HTTP response on {LINKS_CHECKED_ON}. External pages change; if a title or version differs, trust the source.
    </Typography>
    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: 'minmax(0, 1fr)', md: 'repeat(2, minmax(0, 1fr))' }, gap: 2.5 }}>
      {REFERENCE_GROUPS.map((g) => (
        <Box key={g.id} data-testid={`refs-${g.id}`}>
          <SubHeading component="h3">{g.title}</SubHeading>
          <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
            {g.items.map((i) => (
              <Typography key={i.url} component="li" sx={{ fontSize: '0.9375rem', lineHeight: 1.5, mb: 0.5 }}>
                <Link href={i.url} target="_blank" rel="noopener noreferrer">{i.label}</Link>
                {i.note ? <Typography component="span" sx={{ color: 'text.secondary', fontSize: '0.8125rem' }}>{`: ${i.note}`}</Typography> : null}
              </Typography>
            ))}
          </Box>
        </Box>
      ))}
    </Box>
  </Box>
);

export default References;
