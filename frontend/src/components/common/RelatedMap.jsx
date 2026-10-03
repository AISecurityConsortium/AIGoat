import React from 'react';
import PropTypes from 'prop-types';
import { Box, Chip, Tooltip, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { attacksSurfacePath, labPath, riskPath } from '../../utils/taxonomyLinks';
import { useLabs } from '../../hooks/useLabs';
import RiskChip from './RiskChip';

/**
 * @typedef RelatedMapProps
 * @property {string[]} [risks]
 * @property {string} [surface]
 * @property {Array<{id: string, name?: string, surface?: string}>|string[]} [labs]
 * @property {string[]} [relatedLabIds]
 * @property {boolean} [dense]
 */

const RelatedMap = ({ risks = [], surface, labs = [], relatedLabIds = [], dense = false, maxLabs }) => {
  const navigate = useNavigate();
  const { labs: catalog } = useLabs();
  const names = Object.fromEntries((catalog || []).map((lab) => [lab.id, lab.name]));
  const labItems = labs.length
    ? labs
    : relatedLabIds.map((id) => ({ id, name: names[id] }));
  const visibleLabs = Number.isInteger(maxLabs) ? labItems.slice(0, maxLabs) : labItems;
  const hiddenLabCount = labItems.length - visibleLabs.length;
  const hasRisks = risks.length > 0;
  const hasLabs = visibleLabs.length > 0;
  const hasSurface = Boolean(surface);
  if (!hasRisks && !hasLabs && !hasSurface) return null;

  const headingSx = {
    fontSize: dense ? '0.6875rem' : '0.8125rem',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    lineHeight: dense ? '24px' : 1.4,
    color: (t) => t.palette.custom?.text?.muted ?? 'text.secondary',
    ...(dense
      ? { width: 96, flexShrink: 0, whiteSpace: 'nowrap', mb: 0 }
      : { mb: 0.75 }),
  };
  const rowSx = dense
    ? { display: 'flex', alignItems: 'flex-start', gap: 0.75 }
    : undefined;
  const chipsSx = { display: 'flex', gap: dense ? 0.5 : 0.75, flexWrap: 'wrap', minWidth: 0, alignItems: 'center' };
  const denseChipSx = {
    height: 24,
    maxWidth: '100%',
    textDecoration: 'none',
    fontWeight: 700,
    fontSize: '0.75rem',
    '& .MuiChip-label': { px: 0.75, whiteSpace: 'nowrap' },
  };

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: dense ? 0.5 : 1.5, mt: dense ? 0 : 2 }}>
      {hasRisks && (
        <Box sx={rowSx}>
          <Typography sx={headingSx}>
            Risks
          </Typography>
          <Box sx={chipsSx}>
            {risks.map((qualified) => {
              const code = String(qualified).includes(':') ? String(qualified).split(':').slice(1).join(':') : qualified;
              const fw = String(qualified).includes(':') ? String(qualified).split(':')[0] : undefined;
              return (
                <RiskChip
                  key={qualified}
                  code={code}
                  framework={fw}
                  onClick={(event) => {
                    event.stopPropagation();
                    navigate(riskPath(qualified));
                  }}
                />
              );
            })}
          </Box>
        </Box>
      )}
      {hasSurface && (
        <Box sx={rowSx}>
          <Typography sx={headingSx}>
            Surface
          </Typography>
          <Box sx={chipsSx}>
            <Chip
              component={RouterLink}
              to={attacksSurfacePath(surface)}
              label={surface}
              size="small"
              clickable
              sx={dense ? denseChipSx : { textDecoration: 'none' }}
            />
          </Box>
        </Box>
      )}
      {hasLabs && (
        <Box sx={rowSx}>
          <Typography sx={headingSx}>
            Related labs
          </Typography>
          <Box sx={chipsSx}>
            {visibleLabs.map((item) => {
              const id = typeof item === 'string' ? item : item.id;
              const name = (typeof item === 'string' ? names[item] : item.name) || names[id];
              const chip = (
                <Chip
                  component={RouterLink}
                  to={labPath(item)}
                  label={dense ? id : (name || id)}
                  size="small"
                  clickable
                  onClick={(event) => event.stopPropagation()}
                  sx={dense ? denseChipSx : { textDecoration: 'none', fontWeight: 600 }}
                />
              );
              return (
                <Tooltip key={id} title={dense ? (name || id) : id}>
                  <Box component="span">{chip}</Box>
                </Tooltip>
              );
            })}
          </Box>
          {hiddenLabCount > 0 && (
            <Typography sx={{ mt: 0.75, fontSize: '0.8125rem', color: 'text.secondary' }}>
              {`Showing ${visibleLabs.length} of ${labItems.length}`}
            </Typography>
          )}
        </Box>
      )}
    </Box>
  );
};

RelatedMap.propTypes = {
  risks: PropTypes.arrayOf(PropTypes.string),
  surface: PropTypes.string,
  labs: PropTypes.array,
  relatedLabIds: PropTypes.arrayOf(PropTypes.string),
  dense: PropTypes.bool,
  maxLabs: PropTypes.number,
};

export default RelatedMap;
