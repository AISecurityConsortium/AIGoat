import React from 'react';
import { Box, Chip, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography, useMediaQuery } from '@mui/material';
import {
  FRAMEWORKS,
  FRAMEWORK_CATEGORIES,
  MATRIX,
  MATRIX_COLUMNS,
} from '../../data/threatModeling/frameworks';

/**
 * Comparison matrix. On wide screens it is a scrollable table with a sticky
 * first column. On narrow screens each framework becomes a stacked card so no
 * horizontal scrolling is needed to read one resource.
 */
const FrameworkMatrix = () => {
  const stacked = useMediaQuery('(max-width:899px)');

  if (stacked) {
    return (
      <Box data-testid="framework-matrix-stacked" sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
        {FRAMEWORKS.map((f) => (
          <Box
            key={f.id}
            sx={{
              p: 1.5,
              borderRadius: '10px',
              border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
              bgcolor: (t) => t.palette.custom?.surface?.elevated ?? 'background.paper',
            }}
          >
            <Typography sx={{ fontWeight: 700 }}>{f.name}</Typography>
            <Chip size="small" variant="outlined" color="primary" label={FRAMEWORK_CATEGORIES[f.category].label} sx={{ my: 0.75 }} />
            <Box component="dl" sx={{ m: 0 }}>
              {MATRIX_COLUMNS.map((col) => (
                <Box key={col.key} sx={{ mb: 0.75 }}>
                  <Typography component="dt" sx={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'text.secondary' }}>
                    {col.label}
                  </Typography>
                  <Typography component="dd" sx={{ m: 0, fontSize: '0.875rem', lineHeight: 1.5 }}>{MATRIX[f.id][col.key]}</Typography>
                </Box>
              ))}
            </Box>
          </Box>
        ))}
      </Box>
    );
  }

  return (
    <TableContainer
      data-testid="framework-matrix"
      sx={{
        maxHeight: 640,
        borderRadius: '12px',
        border: (t) => `1px solid ${t.palette.custom?.border?.medium ?? t.palette.divider}`,
      }}
    >
      <Table size="small" stickyHeader aria-label="Framework comparison matrix" sx={{ minWidth: 1100 }}>
        <TableHead>
          <TableRow>
            <TableCell sx={{ minWidth: 190, position: 'sticky', left: 0, zIndex: 3, bgcolor: 'background.paper', fontWeight: 700 }}>Resource</TableCell>
            {MATRIX_COLUMNS.map((col) => (
              <TableCell key={col.key} sx={{ minWidth: 170, fontWeight: 700 }}>{col.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {Object.keys(FRAMEWORK_CATEGORIES).map((catKey) => (
            <React.Fragment key={catKey}>
              <TableRow>
                <TableCell
                  colSpan={MATRIX_COLUMNS.length + 1}
                  sx={{ bgcolor: (t) => t.palette.custom?.overlay?.active ?? 'action.hover', fontWeight: 700, fontSize: '0.8125rem' }}
                >
                  {FRAMEWORK_CATEGORIES[catKey].label}
                </TableCell>
              </TableRow>
              {FRAMEWORKS.filter((f) => f.category === catKey).map((f) => (
                <TableRow key={f.id} hover data-testid={`matrix-row-${f.id}`}>
                  <TableCell component="th" scope="row" sx={{ position: 'sticky', left: 0, bgcolor: 'background.paper', fontWeight: 700, verticalAlign: 'top' }}>
                    {f.name}
                  </TableCell>
                  {MATRIX_COLUMNS.map((col) => (
                    <TableCell key={col.key} sx={{ verticalAlign: 'top', fontSize: '0.8125rem', lineHeight: 1.5 }}>{MATRIX[f.id][col.key]}</TableCell>
                  ))}
                </TableRow>
              ))}
            </React.Fragment>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

export default FrameworkMatrix;
